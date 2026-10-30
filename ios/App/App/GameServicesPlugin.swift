import Foundation
import UIKit
import GameKit
import Capacitor

// iCloud save sync and Game Center for the game, in one small plugin.
//
// iCloud: the save is kept in the iCloud key-value store, which follows the player's Apple
// ID to their other devices and survives deleting the app. No sign-in screen: the phone is
// already signed in to iCloud. (The store holds up to 1 MB; a save is far smaller.)
//
// Game Center: signs the player in (usually silently, with a small "Welcome back" banner),
// posts leaderboard scores, reports achievements, and opens the Game Center screens.
@objc(GameServicesPlugin)
public class GameServicesPlugin: CAPPlugin, CAPBridgedPlugin, GKGameCenterControllerDelegate {
    public let identifier = "GameServicesPlugin"
    public let jsName = "GameServices"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "cloudGet", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cloudSet", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "submitScore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reportAchievements", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise),
    ]

    private var cloudObserver: NSObjectProtocol?
    private var signInCalls: [CAPPluginCall] = []
    private var authStarted = false

    override public func load() {
        let store = NSUbiquitousKeyValueStore.default
        // another device saved: tell the game, so it can offer to pick up from there
        cloudObserver = NotificationCenter.default.addObserver(
            forName: NSUbiquitousKeyValueStore.didChangeExternallyNotification, object: store, queue: .main
        ) { [weak self] _ in
            self?.notifyListeners("cloudChanged", data: [:])
        }
        store.synchronize()
    }

    deinit {
        if let o = cloudObserver { NotificationCenter.default.removeObserver(o) }
    }

    // ---- iCloud ----

    @objc func cloudGet(_ call: CAPPluginCall) {
        let key = call.getString("key") ?? "save"
        let store = NSUbiquitousKeyValueStore.default
        store.synchronize()
        if let value = store.string(forKey: key) {
            call.resolve(["value": value])
        } else {
            call.resolve([:])
        }
    }

    @objc func cloudSet(_ call: CAPPluginCall) {
        let key = call.getString("key") ?? "save"
        guard let value = call.getString("value") else { call.reject("No value"); return }
        // the store holds 1 MB in all; keep well clear of it
        if value.utf8.count > 900_000 { call.reject("Save too large for iCloud"); return }
        let store = NSUbiquitousKeyValueStore.default
        store.set(value, forKey: key)
        store.synchronize()
        call.resolve()
    }

    // ---- Game Center ----

    private func playerInfo() -> [String: Any] {
        let p = GKLocalPlayer.local
        return ["signedIn": p.isAuthenticated, "name": p.isAuthenticated ? p.displayName : "", "id": p.isAuthenticated ? p.gamePlayerID : ""]
    }

    @objc func signIn(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let local = GKLocalPlayer.local
            if local.isAuthenticated { call.resolve(self.playerInfo()); return }
            self.signInCalls.append(call)
            if self.authStarted { return }
            self.authStarted = true
            // Game Center calls this when it has an answer, and again if the player signs in
            // or out later (in Settings). If it needs the player to sign in, it hands over
            // its sign-in screen to show.
            local.authenticateHandler = { [weak self] viewController, error in
                guard let self = self else { return }
                if let vc = viewController {
                    self.bridge?.viewController?.present(vc, animated: true)
                    return
                }
                let calls = self.signInCalls
                self.signInCalls = []
                if local.isAuthenticated {
                    calls.forEach { $0.resolve(self.playerInfo()) }
                    self.notifyListeners("gameCenter", data: self.playerInfo())
                } else {
                    calls.forEach { $0.resolve(["signedIn": false, "error": error?.localizedDescription ?? ""]) }
                }
            }
        }
    }

    @objc func submitScore(_ call: CAPPluginCall) {
        guard GKLocalPlayer.local.isAuthenticated else { call.resolve(["ok": false]); return }
        guard let board = call.getString("leaderboard") else { call.reject("No leaderboard"); return }
        let value = call.getInt("value") ?? 0
        GKLeaderboard.submitScore(value, context: 0, player: GKLocalPlayer.local, leaderboardIDs: [board]) { error in
            call.resolve(["ok": error == nil])
        }
    }

    @objc func reportAchievements(_ call: CAPPluginCall) {
        guard GKLocalPlayer.local.isAuthenticated else { call.resolve(["ok": false]); return }
        let ids = call.getArray("ids", String.self) ?? []
        if ids.isEmpty { call.resolve(["ok": true]); return }
        let list = ids.map { id -> GKAchievement in
            let a = GKAchievement(identifier: id)
            a.percentComplete = 100
            a.showsCompletionBanner = call.getBool("banner") ?? true
            return a
        }
        GKAchievement.report(list) { error in
            call.resolve(["ok": error == nil])
        }
    }

    // opens Game Center's own screens: "leaderboards", "achievements" or the dashboard
    @objc func show(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard GKLocalPlayer.local.isAuthenticated else { call.resolve(["ok": false]); return }
            let state: GKGameCenterViewControllerState
            switch call.getString("screen") ?? "" {
            case "leaderboards": state = .leaderboards
            case "achievements": state = .achievements
            default: state = .default
            }
            let vc = GKGameCenterViewController(state: state)
            vc.gameCenterDelegate = self
            self.bridge?.viewController?.present(vc, animated: true)
            call.resolve(["ok": true])
        }
    }

    public func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
        gameCenterViewController.dismiss(animated: true)
    }
}
