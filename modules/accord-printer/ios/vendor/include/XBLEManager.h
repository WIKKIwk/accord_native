//
//  XBLEManager.h
//  PrinterSDK
//
//  Created by max on 2024/5/19.
//

#import <Foundation/Foundation.h>
#import <CoreBluetooth/CoreBluetooth.h>

// 定义标签打印机状态枚举
typedef NS_ENUM(NSInteger, XBLELabelPrinterStatusCode) {
    XBLELabelPrinterStatusIdle = 0,             // Standby
    XBLELabelPrinterStatusPrintHeadOn,          // Print head on
    XBLELabelPrinterStatusPaperJam,             // Paper jam
    XBLELabelPrinterStatusPaperJamHeadOn,       // Paper jam + head on
    XBLELabelPrinterStatusOutOfPaper,           // Out of paper
    XBLELabelPrinterStatusOutOfPaperHeadOn,     // Out of paper + head on
    XBLELabelPrinterStatusRibbonOut,            // Ribbon out
    XBLELabelPrinterStatusRibbonOutHeadOn,      // Ribbon out + head on
    XBLELabelPrinterStatusRibbonOutPaperJam,    // Ribbon out + paper jam
    XBLELabelPrinterStatusRibbonOutPaperJamHeadOn, // Ribbon out + paper jam + head on
    XBLELabelPrinterStatusRibbonOutOutOfPaper,  // Ribbon out + out of paper
    XBLELabelPrinterStatusRibbonOutOutOfPaperHeadOn, // Ribbon out + out of paper + head on
    XBLELabelPrinterStatusPaused,               // Paused
    XBLELabelPrinterStatusPrinting,             // Printing
    XBLELabelPrinterStatusOtherError            // Other error
};

/// Define a protocol named XBLEManagerDelegate, which inherits from the NSObject protocol
@protocol XBLEManagerDelegate <NSObject>
@optional

/// Discover Bluetooth Peripheral
/// @param peripheral The peripheral object
/// @param advertisementData The advertisement data
/// @param RSSI The signal strength
- (void)xbleDiscoverPeripheral:(CBPeripheral *)peripheral advertisementData:(NSDictionary *)advertisementData RSSI:(NSNumber *)RSSI;

/// Connection Successful
/// @param peripheral The connected peripheral
- (void)xbleConnectPeripheral:(CBPeripheral *)peripheral;

/// Connection Failed
/// @param peripheral The peripheral that failed to connect
/// @param error The error information
- (void)xbleFailToConnectPeripheral:(CBPeripheral *)peripheral error:(NSError *)error;

/// Disconnection
/// @param peripheral The disconnected peripheral
/// @param error The error information
- (void)xbleDisconnectPeripheral:(CBPeripheral *)peripheral error:(NSError *)error;

/// Data Send Successful
/// @param characteristic The characteristic object
/// @param error The error information
- (void)xbleWriteValueForCharacteristic:(CBCharacteristic *)characteristic error:(NSError *)error;

/// Received Printer Data
/// @param characteristic The characteristic object
/// @param error The error information
- (void)xbleReceiveValueForCharacteristic:(CBCharacteristic *)characteristic error:(NSError *)error;

/// Bluetooth Central Manager State Update
/// @param state The Bluetooth state
- (void)xbleCentralManagerDidUpdateState:(NSInteger)state;

/// Task state update callback
/// @param taskID Task identifier
/// @param state Task state code
/// @param message Description message
/// @param error Optional error information
- (void)xbleTaskState:(NSString *)taskID state:(int)state message:(NSString *)message error:(NSError *)error;

/// Printer state update callback
/// @param state Printer state code
/// @param message Description message
/// @param error Optional error information
- (void)xblePrinterState:(int)state message:(NSString *)message error:(NSError *)error;

@end
/// Callback block type definition for receiving data.
typedef void (^XBLEManagerReceiveCallBackBlock)(CBCharacteristic *characteristic, NSError *error);

/// Callback block type definition for writing data.
typedef void (^XBLEManagerWriteCallBackBlock)(CBCharacteristic *characteristic, NSError *error);

/// Callback block type definition for reporting POS printer status.
typedef void (^XBLEPOSPrinterStatusBlock)(NSData *status);

/// Callback block type definition for reporting label printer status.
typedef void (^XBLELabelPrinterStatusBlock)(NSData *status);

/// Callback block type definition for reporting printer serial number.
typedef void (^XBLEPrinterSNBlock)(NSString *sn);

/// Callback block type definition for reporting cash box status.
typedef void (^XBLECashBoxBlock)(NSData *status);

/// Callback block for reporting label printer firmware version.
typedef void (^XBLELabelFirmwareVersionBlock)(NSString *version);

/// Callback block for reporting label printer serial number (SN).
typedef void (^XBLELabelPrinterSNBlock)(NSString *serialNumber);

/// Callback block for reporting label printer status (code + message).
typedef void (^XBLELabelPrinterStatusInfoBlock)(int code, NSString *message);

/// Bluetooth Communication Class
@interface XBLEManager : NSObject

/// The name of the Bluetooth device.
@property (nonatomic, copy) NSString *name;

/// The connection status of the Bluetooth device.
@property (nonatomic, assign) BOOL isConnected;

/// The current scanning status of the Bluetooth device.
@property (nonatomic, assign) BOOL isScaning;

/// The peripheral device associated with the write characteristic.
@property (nonatomic, strong) CBPeripheral *writePeripheral;

/// The characteristic used to write data to the peripheral device.
@property (nonatomic, strong) CBCharacteristic *write_characteristic;

/// The characteristic used to read data from the peripheral device.
@property (nonatomic, strong) CBCharacteristic *read_characteristic;

/// The characteristic used to receive notifications from the peripheral device.
@property (nonatomic, strong) CBCharacteristic *notify_characteristic;

/// The UUID used to manually set the filter condition to find a specific printer device.
@property (nonatomic, strong) CBUUID *searchFilterUUID;

/// The UUID of the characteristic.
@property (nonatomic, strong) CBUUID *characteristicUUID;

/// The delegate that receives Bluetooth manager events.
@property (nonatomic, weak) id<XBLEManagerDelegate> delegate;

/// The callback block called when data is received.
@property (nonatomic, copy) XBLEManagerReceiveCallBackBlock receiveBlock;

/// The callback block called when data is written.
@property (nonatomic, copy) XBLEManagerWriteCallBackBlock writeBlock;

/// The callback block called when reporting POS printer status.
@property (nonatomic, copy) XBLEPOSPrinterStatusBlock statusPOSBlock;

/// The callback block called when reporting label printer status.
@property (nonatomic, copy) XBLELabelPrinterStatusBlock statusLabelBlock;

/// The callback block called when reporting printer serial number.
@property (nonatomic, copy) XBLEPrinterSNBlock snBlock;

/// The callback block called when reporting cash box status.
@property (nonatomic, copy) XBLECashBoxBlock cashBoxBlock;

/// Label printer firmware version callback.
@property (nonatomic, copy) XBLELabelFirmwareVersionBlock labelFirmwareVersionBlock;

/// Label printer serial number callback.
@property (nonatomic, copy) XBLELabelPrinterSNBlock labelSNBlock;

/// Label printer status callback property.
@property (nonatomic, copy) XBLELabelPrinterStatusInfoBlock labelStatusInfoBlock;

/// Completion block for write operations.
@property (nonatomic, copy) void (^writeCompletion)(BOOL success, NSUInteger totalBytesSent, NSUInteger currentPackageIndex, CGFloat progress, NSError *error);

/// Singleton object
+ (instancetype)sharedInstance;

/// Remove a delegate object
- (void)removeDelegate:(id<XBLEManagerDelegate>)delegate;

/// Remove all delegate objects
- (void)removeAllDelegates;

/// Start scanning
- (void)startScan;

/// Stop scanning
- (void)stopScan;

/// Connect to a specific device
/// @param peripheral The peripheral object
- (void)connectDevice:(CBPeripheral *)peripheral;

/// Manually disconnect the root peripheral
- (void)disconnectRootPeripheral;

/// Send command (Write with Response)
/// @param data The data to be sent
- (void)writeCommandWithData:(NSData *)data;

/// Send command with receive callback (Write with Response)
/// @param data The data to be sent
/// @param receiveBlock The callback for receiving data
- (void)writeCommandWithData:(NSData *)data receiveCallBack:(XBLEManagerReceiveCallBackBlock)receiveBlock;

/// Send command with write callback (Write with Response)
/// @param data The data to be sent
/// @param writeBlock The callback for writing data
- (void)writeCommandWithData:(NSData *)data writeCallBack:(XBLEManagerWriteCallBackBlock)writeBlock;

/// Send command (Write without Response)
/// @param data The data to be sent
- (void)writeCommandDataWithoutResponse:(NSData *)data;

/// Set Bluetooth name and key
/// @param btName The Bluetooth name
/// @param btKey The Bluetooth key
- (void)setBluetoothNameAndKeyWith:(NSString *)btName btKey:(NSString *)btKey;

/// Printer Status (for receipt printer)
/// @param statusBlock The status callback
- (void)printerPOSStatus:(XBLEPOSPrinterStatusBlock)statusBlock;

/// Printer Status (for label printer)
/// @param statusBlock The status callback
- (void)printerLabelStatus:(XBLELabelPrinterStatusBlock)statusBlock;

/// Printer Serial Number
/// @param snBlock The serial number callback
- (void)printerSN:(XBLEPrinterSNBlock)snBlock;

/// Cash Box Status
/// @param cashBoxBlock The status callback
- (void)cashBoxCheck:(XBLECashBoxBlock)cashBoxBlock;

/// Sends data in specified package sizes and reports the progress via a completion handler.
/// @param data The NSData object containing the data to be sent.
/// @param packageSize The size of each data package to be sent, in bytes.
/// @param completion A block to be executed when the sending operation is completed or an error occurs.
/// The block takes the following parameters:
/// - success: A Boolean indicating whether the data was sent successfully.
/// - totalBytesSent: The total number of bytes that have been sent.
/// - currentPackageIndex: The index of the current package being sent.
/// - error: An NSError object that describes the problem, if any.
- (void)sendData:(NSData *)data withPackageSize:(NSUInteger)packageSize completion:(void (^)(BOOL success, NSUInteger totalBytesSent, NSUInteger currentPackageIndex, CGFloat progress, NSError *error))completion;

/// Query label printer firmware version.
/// @param versionBlock The callback block returning the firmware version string.
- (void)labelPrinterFirmwareVersion:(XBLELabelFirmwareVersionBlock)versionBlock;

/// Query label printer serial number (SN).
/// @param snBlock The callback block returning the serial number string.
- (void)labelPrinterSN:(XBLELabelPrinterSNBlock)snBlock;

/// Query label printer status.
/// @param statusBlock The callback block returning status code and message.
- (void)labelPrinterStatus:(XBLELabelPrinterStatusInfoBlock)statusBlock;

/// Get Copyright Information
+ (NSString *)GetCopyRight;

@end
