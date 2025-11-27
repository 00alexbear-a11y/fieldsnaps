#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

@class ASWebAuthPlugin;

CAP_PLUGIN(ASWebAuthPlugin, "ASWebAuthPlugin",
    CAP_PLUGIN_METHOD(authenticate, CAPPluginReturnPromise);
)
