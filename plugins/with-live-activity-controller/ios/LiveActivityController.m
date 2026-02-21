#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(LiveActivityController, NSObject)

RCT_EXTERN_METHOD(startTimerActivity:(NSString *)activityType
                  babyName:(NSString *)babyName
                  context:(NSString *)context
                  startTimeISO:(NSString *)startTimeISO
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(updateTimerActivity:(NSString *)activityId
                  context:(NSString *)context
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(endTimerActivity:(NSString *)activityId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(endAllActivities:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(endActivityByType:(NSString *)activityType
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(isActivityRunning:(NSString *)activityId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(pauseTimerActivity:(NSString *)activityId
                  activeElapsedSeconds:(nonnull NSNumber *)activeElapsedSeconds
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(resumeTimerActivity:(NSString *)activityId
                  activeElapsedSeconds:(nonnull NSNumber *)activeElapsedSeconds
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
