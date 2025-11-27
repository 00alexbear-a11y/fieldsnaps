#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>
#import "App-Swift.h"

CAP_PLUGIN(ASWebAuthPlugin, "ASWebAuthPlugin",
    CAP_PLUGIN_METHOD(authenticate, CAPPluginReturnPromise);
)
