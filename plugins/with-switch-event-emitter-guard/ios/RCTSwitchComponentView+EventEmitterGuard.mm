/*
 * Guards RCTSwitchComponentView's UIControlEventValueChanged handler against a
 * recycled view. React Native 0.81 dereferences `_eventEmitter` without a null
 * check; Fabric resets it in `prepareForRecycle`, and on iOS 26 UISwitch sends
 * its long-press state change in a deferred after-commit block, so React can
 * unmount the switch between the gesture and the action. Production crash:
 * EXC_BAD_ACCESS at 0x30 in EventEmitter::dispatchEvent <- SwitchEventEmitter::onChange
 * <- -[RCTSwitchComponentView onChange:] (4.9.12, iOS 26.6.1).
 *
 * Remove once React Native ships the null check upstream.
 */
#import <objc/runtime.h>
#import <React/RCTSwitchComponentView.h>
#import <React/RCTViewComponentView.h>

@interface RCTSwitchComponentView (SofiEventEmitterGuard)
@end

@implementation RCTSwitchComponentView (SofiEventEmitterGuard)

+ (void)load
{
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    Method original = class_getInstanceMethod(self, NSSelectorFromString(@"onChange:"));
    Method guarded = class_getInstanceMethod(self, @selector(sofi_guardedOnChange:));
    if (original && guarded) {
      method_exchangeImplementations(original, guarded);
    }
  });
}

- (void)sofi_guardedOnChange:(UISwitch *)sender
{
  if (!_eventEmitter) {
    // View was unmounted or recycled while the UISwitch gesture was pending.
    return;
  }
  [self sofi_guardedOnChange:sender]; // swizzled: calls the original onChange:
}

@end
