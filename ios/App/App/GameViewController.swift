import UIKit
import Capacitor

// The game's main screen: Capacitor's web view, with the app's own plugin (iCloud saves and
// Game Center, GameServicesPlugin.swift) registered alongside the ones from npm.
class GameViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(GameServicesPlugin())
    }
}
