#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN
FOUNDATION_EXPORT UIGestureRecognizer *AccordAdminSheetAttachTouchHandler(UIView *view);
FOUNDATION_EXPORT void AccordAdminSheetDetachTouchHandler(UIGestureRecognizer *handler, UIView *view);
FOUNDATION_EXPORT BOOL AccordAdminSheetMatchesNativeID(UIView *view, NSString *nativeID);
NS_ASSUME_NONNULL_END
