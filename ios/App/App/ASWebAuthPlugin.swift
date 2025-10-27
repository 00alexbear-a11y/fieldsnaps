import Foundation
import Capacitor
import AuthenticationServices

@objc(ASWebAuthPlugin)
public class ASWebAuthPlugin: CAPPlugin, ASWebAuthenticationPresentationContextProviding {
    
    private var currentSession: ASWebAuthenticationSession?
    
    @objc func authenticate(_ call: CAPPluginCall) {
        guard let authUrl = call.getString("url") else {
            call.reject("URL is required")
            return
        }
        
        guard let callbackScheme = call.getString("callbackScheme") else {
            call.reject("callbackScheme is required")
            return
        }
        
        guard let url = URL(string: authUrl) else {
            call.reject("Invalid URL")
            return
        }
        
        DispatchQueue.main.async {
            // Create ASWebAuthenticationSession
            self.currentSession = ASWebAuthenticationSession(
                url: url,
                callbackURLScheme: callbackScheme
            ) { [weak self] callbackURL, error in
                guard let self = self else { return }
                
                if let error = error {
                    // Check if user cancelled
                    if let authError = error as? ASWebAuthenticationSessionError,
                       authError.code == .canceledLogin {
                        call.reject("User cancelled authentication")
                    } else {
                        call.reject("Authentication failed: \(error.localizedDescription)")
                    }
                    return
                }
                
                guard let callbackURL = callbackURL else {
                    call.reject("No callback URL received")
                    return
                }
                
                // Extract query parameters
                var result: [String: Any] = [:]
                result["url"] = callbackURL.absoluteString
                
                if let components = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false),
                   let queryItems = components.queryItems {
                    var params: [String: String] = [:]
                    for item in queryItems {
                        if let value = item.value {
                            params[item.name] = value
                        }
                    }
                    result["params"] = params
                }
                
                call.resolve(result)
            }
            
            // Set presentation context provider (required iOS 13+)
            self.currentSession?.presentationContextProvider = self
            
            // Don't use ephemeral session - allow SSO with Safari cookies
            self.currentSession?.prefersEphemeralWebBrowserSession = false
            
            // Start the authentication session
            self.currentSession?.start()
        }
    }
    
    // Required for ASWebAuthenticationPresentationContextProviding
    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return UIApplication.shared.windows.first { $0.isKeyWindow } ?? ASPresentationAnchor()
    }
}
