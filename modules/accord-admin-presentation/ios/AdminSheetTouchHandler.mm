#import "AdminSheetTouchHandler.h"
#import <React/RCTSurfaceTouchHandler.h>
#import <React/RCTViewComponentView.h>
#import <React/UIView+React.h>

UIGestureRecognizer *AccordAdminSheetAttachTouchHandler(UIView *view) {
  RCTSurfaceTouchHandler *handler = [RCTSurfaceTouchHandler new];
  [handler attachToView:view]; return handler;
}
void AccordAdminSheetDetachTouchHandler(UIGestureRecognizer *handler, UIView *view) {
  if ([handler isKindOfClass:[RCTSurfaceTouchHandler class]]) [(RCTSurfaceTouchHandler *)handler detachFromView:view];
}
BOOL AccordAdminSheetMatchesNativeID(UIView *view, NSString *nativeID) {
  if ([view isKindOfClass:[RCTViewComponentView class]]) return [((RCTViewComponentView *)view).nativeId isEqualToString:nativeID];
  return [view.nativeID isEqualToString:nativeID];
}
