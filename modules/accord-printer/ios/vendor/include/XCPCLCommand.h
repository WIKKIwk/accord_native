//
//  XCPCLCommand.h
//  PrinterSDK
//
//  Created by max on 2024/5/24.
//

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import "XConstants.h"

NS_ASSUME_NONNULL_BEGIN
/// CPCL Command Class
@interface XCPCLCommand : NSObject

/// Get the Printing Command
///
/// This will retrieve the current CPCL object's printing data
- (NSData*)getCommand;

/// Set Character Encoding
///
/// @param encoding Encoding format, default is GB_18030_2000
/// @return XCPCLCommand
- (XCPCLCommand *)setCharEncoding:(NSStringEncoding)encoding;

/// Add Custom Data
///
/// @param customData Custom data content
/// @return XCPCLCommand
- (XCPCLCommand *)addData:(NSData *)customData;

/// Label Initialization
///
/// @param height Maximum height of the label
/// @return XCPCLCommand
- (XCPCLCommand *)initializeLabelWithHeight:(int)height;

/// Label Initialization
///
/// @param height Maximum height of the label
/// @param count Number of labels to print, default is 1
/// @return XCPCLCommand
- (XCPCLCommand *)initializeLabelWithHeight:(int)height count:(int)count;

/// Label Initialization
///
/// @param height Maximum height of the label
/// @param count Number of labels to print, default is 1
/// @param offsetx Horizontal offset of the label, default is 0
/// @return XCPCLCommand
- (XCPCLCommand *)initializeLabelWithHeight:(int)height count:(int)count offsetx:(int)offsetx;

/// Text Printing
///
/// @param x Starting X coordinate of the text
/// @param y Starting Y coordinate of the text
/// @param content Text content
/// @return XCPCLCommand
- (XCPCLCommand *)addTextAtX:(int)x
                        y:(int)y
                    content:(NSString *)content;

/// Text Printing
///
/// @param x Starting X coordinate of the text
/// @param y Starting Y coordinate of the text
/// @param font Text font type, default is CPCLFont0
/// | Variable     | Description |
/// |--------------|-------------|
/// | CPCLFont0    | Font 0      |
/// | CPCLFont1    | Font 1      |
/// | CPCLFont2    | Font 2      |
/// | CPCLFont3    | Font 3      |
/// | CPCLFont4    | Font 4      |
/// | CPCLFont5    | Font 5      |
/// | CPCLFont6    | Font 6      |
/// | CPCLFont7    | Font 7      |
/// | CPCLFont24   | Font 24     |
/// | CPCLFont55   | Font 55     |
/// @param content Text content
/// @return XCPCLCommand
- (XCPCLCommand *)addTextAtX:(int)x
                        y:(int)y
                     font:(FontCPCL)font
                    content:(NSString *)content;

/// Text Printing
///
/// @param x Starting X coordinate of the text
/// @param y Starting Y coordinate of the text
/// @param rotation Clockwise rotation angle, default is CPCLRotation0
/// | Variable        | Description       |
/// |-----------------|-------------------|
/// | CPCLRotation0   | No rotation       |
/// | CPCLRotation90  | Rotate 90 degrees |
/// | CPCLRotation180 | Rotate 180 degrees|
/// | CPCLRotation270 | Rotate 270 degrees|
/// @param font Text font type, default is CPCLFont0
/// @param content Text content
/// @return XCPCLCommand
- (XCPCLCommand *)addTextAtX:(int)x
                        y:(int)y
                     rotation:(RotationCPCL)rotation
                     font:(FontCPCL)font
                    content:(NSString *)content;

/// Enlarge the resident font by the specified multiple
///
/// @param w Width magnification factor 1~16
/// @param h Height magnification factor 1~16
/// @return XCPCLCommand
- (XCPCLCommand *)setmagWithw:(int)w h:(int)h;


/// End command for the entire command set, which will start file printing
/// @return XCPCLCommand
- (XCPCLCommand *)addPrint;

#pragma mark - Draw 1D Barcode

/// Horizontal 1D Barcode
///
/// @param x Starting X coordinate of the barcode, in dots
/// @param y Starting Y coordinate of the barcode, in dots
/// @param type Barcode type, refer to CPCLBarCodeType for details
/// | Variable        | Description |
/// |-----------------|-------------|
/// | CPCLBarCode128  | Code 128    |
/// | CPCLBarCodeUPCA | UPC-A       |
/// | CPCLBarCodeUPCE | UPC-E       |
/// | CPCLBarCodeEAN13| EAN-13      |
/// | CPCLBarCodeEAN8 | EAN-8       |
/// | CPCLBarCode39   | Code 39     |
/// | CPCLBarCode93   | Code 93     |
/// | CPCLBarCodeCODABAR| CODABAR   |
/// @param height Barcode unit height
/// @param content Barcode data content
/// @return XCPCLCommand
- (XCPCLCommand *)addBarcodeAtX:(int)x
                           y:(int)y
                        type:(CPCLBarCodeType)type
                      height:(int)height
                     content:(NSString *)content;

/// Horizontal 1D Barcode
///
/// @param x Starting X coordinate of the barcode, in dots
/// @param y Starting Y coordinate of the barcode, in dots
/// @param type Barcode type, refer to CPCLBarCodeType for details
/// @param width Narrow bar unit width, default is 1
/// @param ratio Ratio of wide bar to narrow bar, default is CPCLBarCodeRatio1 (2.0:1)
/// | Variable         | Description        |
/// |------------------|-------------------|
/// | CPCLBarCodeRatio0 | Wide:Narrow = 1.5:1 |
/// | CPCLBarCodeRatio1 | Wide:Narrow = 2.0:1 |
/// | CPCLBarCodeRatio2 | Wide:Narrow = 2.5:1 |
/// | CPCLBarCodeRatio3 | Wide:Narrow = 3.0:1 |
/// | CPCLBarCodeRatio4 | Wide:Narrow = 3.5:1 |
/// | CPCLBarCodeRatio20| Wide:Narrow = 2.0:1 |
/// | CPCLBarCodeRatio21| Wide:Narrow = 2.1:1 |
/// | CPCLBarCodeRatio22| Wide:Narrow = 2.2:1 |
/// | CPCLBarCodeRatio23| Wide:Narrow = 2.3:1 |
/// | CPCLBarCodeRatio24| Wide:Narrow = 2.4:1 |
/// | CPCLBarCodeRatio25| Wide:Narrow = 2.5:1 |
/// | CPCLBarCodeRatio26| Wide:Narrow = 2.6:1 |
/// | CPCLBarCodeRatio27| Wide:Narrow = 2.7:1 |
/// | CPCLBarCodeRatio28| Wide:Narrow = 2.8:1 |
/// | CPCLBarCodeRatio29| Wide:Narrow = 2.9:1 |
/// | CPCLBarCodeRatio30| Wide:Narrow = 3.0:1 |
/// @param height Barcode unit height
/// @param content Barcode data content
/// @return XCPCLCommand
- (XCPCLCommand *)addBarcodeAtX:(int)x
                           y:(int)y
                        type:(CPCLBarCodeType)type
                       width:(int)width
                       ratio:(BarCodeRatioCPCL)ratio
                      height:(int)height
                     content:(NSString *)content;

/// Vertical 1D Barcode
///
/// @param x Starting X coordinate of the barcode, in dots
/// @param y Starting Y coordinate of the barcode, in dots
/// @param type Barcode type, refer to CPCLBarCodeType for details
/// @param height Barcode unit height
/// @param content Barcode data content
/// @return XCPCLCommand
- (XCPCLCommand *)addBarcodeVAtX:(int)x
                           y:(int)y
                        type:(CPCLBarCodeType)type
                      height:(int)height
                     content:(NSString *)content;

/// Vertical 1D Barcode
///
/// @param x Starting X coordinate of the barcode, in dots
/// @param y Starting Y coordinate of the barcode, in dots
/// @param type Barcode type, refer to CPCLBarCodeType for details
/// @param width Narrow bar unit width, default is 1
/// @param ratio Ratio of wide bar to narrow bar, default is CPCLBarCodeRatio1 (2.0:1)
/// @param height Barcode unit height
/// @param content Barcode data content
/// @return XCPCLCommand
- (XCPCLCommand *)addBarcodeVAtX:(int)x
                           y:(int)y
                        type:(CPCLBarCodeType)type
                       width:(int)width
                       ratio:(BarCodeRatioCPCL)ratio
                      height:(int)height
                     content:(NSString *)content;

/// Add Barcode Text
///
/// @param offsetx Text offset from the barcode, in units
/// @return XCPCLCommand
- (XCPCLCommand *)barcodeText:(int)offsetx;

/// Cancel Barcode Text
/// @return XCPCLCommand
- (XCPCLCommand *)barcodeTextOff;

/// Draw QR Code
/// @param x Starting X coordinate of the QR code
/// @param y Starting Y coordinate of the QR code
/// @param content QR code data content
/// @return XCPCLCommand
- (XCPCLCommand *)addQRCodeAtX:(int)x
                         y:(int)y
                     content:(NSString *)content;

/// Draw QR Code
/// @param x Starting X coordinate of the QR code
/// @param y Starting Y coordinate of the QR code
/// @param codeModel QR Code specification number, default is CPCLQRCodeModeEnhance
/// | Variable           | Description     |
/// |-------------------|-----------------|
/// | CPCLQRCodeModeORG  | Original spec   |
/// | CPCLQRCodeModeEnhance | Enhanced spec |
/// @param cellWidth Cell size, range [1, 32], default is 6
/// @param content QR code data content
/// @return XCPCLCommand
- (XCPCLCommand *)addQRCodeAtX:(int)x
                         y:(int)y
                   codeModel:(QRCodeModesCPCL)codeModel
                   cellWidth:(int)cellWidth
                     content:(NSString *)content;

/// Draw Rectangle
///
/// @param x Starting X coordinate of the rectangle, in dots
/// @param y Starting Y coordinate of the rectangle, in dots
/// @param width Rectangle width, in dots
/// @param height Rectangle height, in dots
/// @param thickness Line width
/// @return XCPCLCommand
- (XCPCLCommand *)addBoxAtX:(int)x
                       y:(int)y
                   width:(int)width
                  height:(int)height
               thickness:(int)thickness;

/// Draw Line
///
/// @param x Starting X coordinate of the line, in dots
/// @param y Starting Y coordinate of the line, in dots
/// @param xend Ending X coordinate of the line, in dots
/// @param yend Ending Y coordinate of the line, in dots
/// @param width Line width
/// @return XCPCLCommand
- (XCPCLCommand *)addLineAtX:(int)x y:(int)y xend:(int)xend yend:(int)yend width:(int)width;

/// Reverse the data in the specified area
///
/// @param x Starting X coordinate of the inverse area, in dots
/// @param y Starting Y coordinate of the inverse area, in dots
/// @param xend Ending X coordinate of the inverse area, in dots
/// @param yend Ending Y coordinate of the inverse area, in dots
/// @param width Inverse area width
/// @return XCPCLCommand
- (XCPCLCommand *)addInverseLineAtX:(int)x
                              y:(int)y
                           xend:(int)xend
                           yend:(int)yend
                          width:(int)width;

/// Draw Image
///
/// @param x Starting X coordinate of the image, in dots
/// @param y Starting Y coordinate of the image, in dots
/// @param image Image object
/// @return XCPCLCommand
- (XCPCLCommand *)addGraphicsAtX:(int)x y:(int)y image:(UIImage *)image;


/// Set the alignment of the field
///
/// By default, the printer will left-align all fields. The alignment command will remain effective for all subsequent fields until another alignment command is specified.
///
/// @param align Alignment mode
/// | Variable          | Description                |
/// |-------------------|----------------------------|
/// | CPCLAlignmentLeft  | Left-align all subsequent fields |
/// | CPCLAlignmentCenter| Center-align all subsequent fields |
/// | CPCLAlignmentRight | Right-align all subsequent fields |
/// @return XCPCLCommand
- (XCPCLCommand *)addAlign:(AlignmentsCPCL)align;

/// Set the alignment of the field
///
/// By default, the printer will left-align all fields. The alignment command will remain effective for all subsequent fields until another alignment command is specified.
///
/// @param align Alignment mode
/// @param end Alignment end point
/// @return XCPCLCommand
- (XCPCLCommand *)addAlign:(AlignmentsCPCL)align end:(int)end;

/// Set the Print Speed
///
/// @param level Speed level, range [0, 5]
/// @return XCPCLCommand
- (XCPCLCommand *)addSpeed:(int)level;

/// Set the Page Width
///
/// @param width Page unit width
/// @return XCPCLCommand
- (XCPCLCommand *)addPageWidth:(int)width;

/// Set the Beep Duration
///
/// This method is used to make the printer's buzzer emit a sound for the given duration. Printers without a buzzer will ignore this method.
///
/// @param length Beep duration, in 1/8 second units, e.g. 16 means 2 seconds
/// @return XCPCLCommand
- (XCPCLCommand *)addBeep:(int)length;

/// Indicate the printer to advance to the top of the next page after the current page is printed
/// @return XCPCLCommand
- (XCPCLCommand *)form;

@end

NS_ASSUME_NONNULL_END
