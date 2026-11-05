//
//  XWIFIManager.h
//  PrinterSDK
//
//  Created by max on 2024/5/19.
//

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import "NetProfile.h"
@class XWIFIManager;
/// Define a protocol named XWIFIManagerDelegate that inherits from the NSObject protocol
@protocol XWIFIManagerDelegate <NSObject>
@optional

/// Callback for successful connection
///
/// @param host Host address
/// @param port Port number
- (void)xWifiConnectedToHost:(NSString *)host port:(UInt16)port;

/// Callback for disconnection error
/// @param error Error information
- (void)xWifiDisconnectWithError:(NSError *)error;

/// Callback for successful data transmission
/// @param tag Tag value
- (void)xWifiWriteValueWithTag:(long)tag;

/// Callback for receiving data from the printer
/// @param data Received data
- (void)xWifiReceiveValueForData:(NSData *)data;

@end

/// Definition of the callback block type for receiving data.
typedef void (^XWIFIManagerReceiveBlock)(NSData *data);

/// Definition of the callback block type for writing data.
typedef void (^XWIFIManagerWriteBlock)(BOOL success, NSError *error);

/// Definition of the callback block type for reporting POS printer status.
typedef void (^XWIFIPOSPrinterStatusBlock)(NSData *status);

/// Definition of the callback block type for reporting label printer status.
typedef void (^XWIFILabelPrinterStatusBlock)(NSData *status);

/// Definition of the callback block type for reporting printer serial number.
typedef void (^XWIFIPrinterSNBlock)(NSString *sn);

/// Definition of the callback block type for checking POS printer status.
typedef void (^XWIFIPOSPrinterCheckBlock)(NSData *check);

/// Definition of the callback block type for discovering printers.
typedef void (^XWIFIManagerFoundPrinterBlock)(NetProfile *foundPrinter);

/// Definition of the callback block type for reporting cash drawer status.
typedef void (^XWIFICashBoxBlock)(NSData *status);


@class NetProfile;

/// Network communication class
@interface XWIFIManager : NSObject
/// Host address string.
@property (nonatomic, copy) NSString *hostStr;

/// Port number.
@property (nonatomic, assign) UInt16 port;

/// Connection status.
@property (nonatomic, assign) BOOL isConnected;

/// Delegate to receive WiFi manager events.
@property (nonatomic, weak) id<XWIFIManagerDelegate> delegate;

/// Callback block called when data is received.
@property (nonatomic, copy) XWIFIManagerReceiveBlock receiveBlock;

/// Callback block called when data is written.
@property (nonatomic, copy) XWIFIManagerWriteBlock writeBlock;

/// Callback block called when reporting POS printer status.
@property (nonatomic, copy) XWIFIPOSPrinterStatusBlock statusPOSBlock;

/// Callback block called when reporting label printer status.
@property (nonatomic, copy) XWIFILabelPrinterStatusBlock statusLabelBlock;

/// Callback block called when reporting printer serial number.
@property (nonatomic, copy) XWIFIPrinterSNBlock snBlock;

/// Callback block called when checking POS printer status.
@property (nonatomic, copy) XWIFIPOSPrinterCheckBlock checkPOSBlock;

/// Callback block called when a printer is discovered.
@property (nonatomic, copy) XWIFIManagerFoundPrinterBlock foundPrinterBlock;

/// Callback block called when reporting cash drawer status.
@property (nonatomic, copy) XWIFICashBoxBlock cashBoxBlock;

/// Configuration profile of the connected printer.
@property (nonatomic, strong) NetProfile *connectedPrinter;


/// Get the singleton instance
+ (instancetype)sharedInstance;

/// Remove a delegate object
/// @param delegate Delegate object
- (void)removeDelegate:(id<XWIFIManagerDelegate>)delegate;

/// Remove all delegate objects
- (void)removeAllDelegates;

/// Connect to the printer address
/// @param hostStr Printer host address
/// @param port Port number
- (void)connectWithHost:(NSString *)hostStr port:(UInt16)port;

/// Disconnect
- (void)disconnect;

/// Write commands to the printer
/// @param data Command data
- (void)writeCommandWithData:(NSData *)data;

/// Write commands to the printer and specify a receive callback
/// @param data Command data
/// @param receiveBlock Receive callback
- (void)writeCommandWithData:(NSData *)data receiveCallBack:(XWIFIManagerReceiveBlock)receiveBlock;

/// Write commands to the printer and specify a write completion callback
/// @param data Command data
/// @param writeBlock Write completion callback
- (void)writeCommandWithData:(NSData *)data writeCallBack:(XWIFIManagerWriteBlock)writeBlock;

/// Create a UDP Socket
/// @return Whether the creation was successful
- (BOOL)createUdpSocket;

/// Close the UDP Socket
- (void)closeUdpSocket;

/// Search for printers
/// @param foundPrinterBlock Callback when a printer is found
- (void)sendFindCmd:(XWIFIManagerFoundPrinterBlock)foundPrinterBlock;

/// Set IP configuration
/// @param ip IP address
/// @param mask Subnet mask
/// @param gateway Gateway
/// @param dhcp Whether to enable DHCP
- (void)setIPConfigWithIP:(NSString *)ip Mask:(NSString *)mask Gateway:(NSString *)gateway DHCP:(BOOL)dhcp;

/// Set WiFi configuration
///
/// @param ip IP address
/// @param mask Subnet mask
/// @param gateway Gateway
/// @param ssid WiFi SSID
/// @param password WiFi password
/// @param encrypt Encryption method
- (void)setWiFiConfigWithIP:(NSString *)ip mask:(NSString *)mask gateway:(NSString *)gateway ssid:(NSString *)ssid password:(NSString *)password encrypt:(NSUInteger)encrypt;

/// Check printer connection status
/// @return Whether connected
- (BOOL)printerIsConnect;

/// Get printer serial number
/// @param snBlock Serial number callback
- (void)printerSN:(XWIFIPrinterSNBlock)snBlock;

/// Connect to the printer by MAC address
/// @param macStr MAC address
- (void)connectWithMac:(NSString *)macStr;

/// Printer status (for receipt printers)
/// @param statusBlock Status callback
- (void)printerPOSStatus:(XWIFIPOSPrinterStatusBlock)statusBlock;

/// Printer status (for label printers)
/// @param statusBlock Status callback
- (void)printerLabelStatus:(XWIFILabelPrinterStatusBlock)statusBlock;

/// Query printer status
/// @param type Query type (1: common status, 2: offline status, 3: error status, 4: paper feed status)
/// @param checkBlock Query result callback
- (void)printerPOSCheck:(int)type checkBlock:(XWIFIPOSPrinterCheckBlock)checkBlock;

/// Cash drawer status
/// @param cashBoxBlock Status callback
- (void)cashBoxCheck:(XWIFICashBoxBlock)cashBoxBlock;

/// Get copyright information
/// @return Copyright information string
+ (NSString *)GetCopyRight;

@end
