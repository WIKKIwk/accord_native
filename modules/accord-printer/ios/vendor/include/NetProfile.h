//
//  NetProfile.h
//  PrinterSDK
//
//  Created by max on 2024/5/27.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN
/// Network Configuration Class
@interface NetProfile : NSObject
/// Printer Name
@property (nonatomic, readonly) NSString *printerName;

/// Printer Description
@property (nonatomic, readonly) NSString *printerDesc;

/// Set MAC Address
- (void)setMAC:(NSData *)mac;

/// Set IP Address
- (void)setIP:(NSData *)ip;

/// Set Subnet Mask
- (void)setMask:(NSData *)mask;

/// Set Gateway Address
- (void)setGateway:(NSData *)gw;

/// Set DHCP
/// @param dhcp 1 to enable DHCP, 0 to disable
- (void)setDHCP:(char)dhcp;

/// Get IP Address as String
/// @return IP Address as String
- (NSString *)getIPString;

/// Get Subnet Mask as String
/// @return Subnet Mask as String
- (NSString *)getMaskString;

/// Get Gateway Address as String
/// @return Gateway Address as String
- (NSString *)getGatewayString;

/// Get DHCP Setting
/// @return DHCP Setting, 1 for enabled, 0 for disabled
- (char)getDHCP;

/// Get MAC Address Array
/// @return MAC Address Array
- (Byte *)getMACArray;

@end

NS_ASSUME_NONNULL_END
