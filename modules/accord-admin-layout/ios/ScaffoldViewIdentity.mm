#import "ScaffoldViewIdentity.h"
#import <React/RCTViewComponentView.h>
#import <React/UIView+React.h>

BOOL AccordAdminScaffoldViewMatchesNativeID(UIView *view, NSString *nativeID) {
  if ([view isKindOfClass:[RCTViewComponentView class]]) {
    return [((RCTViewComponentView *)view).nativeId isEqualToString:nativeID];
  }
  return [view.nativeID isEqualToString:nativeID];
}
