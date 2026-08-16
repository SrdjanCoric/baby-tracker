#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(SharedSupabaseSession, NSObject)

RCT_EXTERN_METHOD(readSession:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(writeSession:(NSString *)envelopeJson
                  expectedRevision:(NSNumber * _Nullable)expectedRevision
                  handle:(NSString *)handle
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(removeSession:(NSNumber *)expectedRevision
                  expectedLineage:(NSString *)expectedLineage
                  handle:(NSString *)handle
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(purgeSession:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(acquireSessionLock:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(releaseSessionLock:(NSString *)handle
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
