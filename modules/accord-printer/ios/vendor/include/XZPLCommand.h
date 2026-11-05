//
//  XZPLCommand.h
//  PrinterSDK
//
//  Created by max on 2024/5/24.
//

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import "XConstants.h"
/// ZPL Command Class
@interface XZPLCommand : NSObject

/// Get the Print Command
///
/// This will retrieve the current ZPL object's print data
- (NSData*)getCommand;

/// Set Character Encoding
///
/// @param encoding Encoding format, default is GB_18030_2000
/// @return XZPLCommand
- (XZPLCommand *)setCharEncoding:(NSStringEncoding)encoding;

/// Add Custom Data
///
/// @param customData Custom data content
/// @return XZPLCommand
- (XZPLCommand *)addData:(NSData *)customData;

/// This method is used for the beginning of the label
///
/// - Note: Note that the start command must be added at the beginning of the print content
/// @return XZPLCommand
- (XZPLCommand *)start;

/// End of the label format. Calling this method will print the label
///
/// - Note: Note that the end command must be added at the end of the print content
/// @return XZPLCommand
- (XZPLCommand *)end;

/// Text Printing
///
/// The font type for the text is ZPLFont26_13 by default
///
/// @param x Starting x value of the text
/// @param y Starting y value of the text
/// @param content Text content
/// @return XZPLCommand
- (XZPLCommand *)addTextAtX:(int)x y:(int)y content:(NSString *)content;

/// Text Printing
///
/// @param x Starting x value of the text
/// @param y Starting y value of the text
/// @param fontName Text font type, default is FNT_F
/// | Variable | Basic Font Size (Height x Width) |
/// |----------|----------------------------------|
/// | FNT_A    | 9 x 5                           |
/// | FNT_B    | 11 x 7                          |
/// | FNT_C    | 18 x 10                         |
/// | FNT_D    | 18 x 10                         |
/// | FNT_E    | 28 x 15                         |
/// | FNT_F    | 26 x 13                         |
/// | FNT_G    | 60 x 40                         |
/// | FNT_0    | 15 x 12                         |
/// @param content Text content
/// @return XZPLCommand
- (XZPLCommand *)addTextAtX:(int)x
                 y:(int)y
          fontName:(NSString *)fontName
           content:(NSString *)content;

/// Text Printing
///
/// @param x Starting x value of the text
/// @param y Starting y value of the text
/// @param fontName Text font type, default is FNT_F
/// @param sizeW Effective text width, default is the basic size. Please use integer multiples of the basic size
/// @param sizeH Effective text height, default is the basic size. Please use integer multiples of the basic size
/// @param content Text content
/// @return XZPLCommand
- (XZPLCommand *)addTextAtX:(int)x
              y:(int)y
       fontName:(NSString *)fontName
          sizeW:(int)sizeW
          sizeH:(int)sizeH
        content:(NSString *)content;

/// Text Printing
///
/// @param x Starting x value of the text
/// @param y Starting y value of the text
/// @param fontName Text font type, default is FNT_F
/// @param rotation Clockwise rotation angle, default is ZPLRotation0
/// | Variable      | Description        |
/// |---------------|-------------------|
/// | ZPLRotation0   | No rotation       |
/// | ZPLRotation90  | Rotate 90 degrees |
/// | ZPLRotation180 | Rotate 180 degrees|
/// | ZPLRotation270 | Rotate 270 degrees|
/// @param sizeW Effective text width, default is the basic size. Please use integer multiples of the basic size
/// @param sizeH Effective text height, default is the basic size. Please use integer multiples of the basic size
/// @param content Text content
/// @return XZPLCommand
- (XZPLCommand *)addTextAtX:(int)x
              y:(int)y
       fontName:(NSString *)fontName
       rotation:(RotationZPL)rotation
          sizeW:(int)sizeW
          sizeH:(int)sizeH
        content:(NSString *)content;

/// Set Custom Font
///
/// @param fontName Font library name
/// @param extension Font name suffix
/// @param alias Font alias, corresponding to the fontName in addText. Range: A to Z and 0 to 9.
/// @param codePage Refer to the CodePageZPL enumeration for details
/// | Value             | Encoding (Code Page)     | Code Page Number   |
/// |-------------------|--------------------------|-------------------|
/// | ZPLCodePageUSA1   | USA 1                    | 0 (Code Page 850) |
/// | ZPLCodePageUSA2   | USA 2                    | 1 (Code Page 437) |
/// | ZPLCodePageUK     | United Kingdom           | 2 (Code Page 850) |
/// | ZPLCodePageNL     | Netherlands              | 3 (Code Page 850) |
/// | ZPLCodePageDK     | Denmark                  | 4 (Code Page 850) |
/// | ZPLCodePageSwede  | Sweden                   | 5 (Code Page 850) |
/// | ZPLCodePageGER    | Germany                  | 6 (Code Page 850) |
/// | ZPLCodePageFR1    | France 1                 | 7 (Code Page 850) |
/// | ZPLCodePageFR2    | France 2                 | 8 (Code Page 850) |
/// | ZPLCodePageITA    | Italy                    | 9 (Code Page 850) |
/// | ZPLCodePageES     | Spain                    | 10 (Code Page 850)|
/// | ZPLCodePageJA     | Japan                    | 12 (Code Page 932)|
/// | ZPLCodePageUTF8   | UTF-8                    | 28                |
/// | ZPLCodePageUTF16Big | UTF-16 Big Endian      | 29                |
/// | ZPLCodePageUTF16Little | UTF-16 Little Endian| 30                |
/// @return XZPLCommand
- (XZPLCommand *)setCustomFont:(NSString *)fontName
            extension:(NSString *)extension
                alias:(NSString *)alias
             codePage:(CodePageZPL)codePage;

/// Set Printer Width
///
/// @param width Paper width in dots
/// @return XZPLCommand
- (XZPLCommand *)setPrinterWidth:(int)width;

/// Set Label Length
///
/// After issuing the set label length command, this setting will remain in effect until the printer is turned off or a new set label length command is sent
///
/// @param height Label length in dots [1 to 32000, not exceeding the maximum label size]
/// @return XZPLCommand
- (XZPLCommand *)setLabelLength:(int)height;

/// Reverse Area
///
/// @param x Starting x value of the area
/// @param y Starting y value of the area
/// @param width Area width
/// @param height Area height
/// @return XZPLCommand
- (XZPLCommand *)addReverseAtX:(int)x
                 y:(int)y
             width:(int)width
            height:(int)height;

/// Reverse Area
///
/// @param x Starting x value of the area
/// @param y Starting y value of the area
/// @param width Area width
/// @param height Area height
/// @param radius Rounding degree, range: 0~8, default is 0
/// @return XZPLCommand
- (XZPLCommand *)addReverseAtX:(int)x
                 y:(int)y
             width:(int)width
            height:(int)height
            radius:(int)radius;

/// Draw Rectangle
///
/// @param x Starting x value of the rectangle
/// @param y Starting y value of the rectangle
/// @param width Rectangle width
/// @param height Rectangle height
/// @param thickness Line thickness
/// @return XZPLCommand
- (XZPLCommand *)addBoxAtX:(int)x
             y:(int)y
         width:(int)width
        height:(int)height
     thickness:(int)thickness;

/// Draw Rectangle
///
/// @param x Starting x value of the rectangle
/// @param y Starting y value of the rectangle
/// @param width Rectangle width
/// @param height Rectangle height
/// @param thickness Line thickness
/// @param radius Rounding degree, range: 0~8, default is 0
/// @return XZPLCommand
- (XZPLCommand *)addBoxAtX:(int)x
             y:(int)y
         width:(int)width
        height:(int)height
     thickness:(int)thickness
        radius:(int)radius;


/// This function is used to draw a diagonal line
///
/// @param x Horizontal starting position
/// @param y Vertical starting position
/// @param orientation Direction of the diagonal line
/// | Variable | Description                  |
/// |----------|------------------------------|
/// | DiagonalDirectionRight    | Right-leaning diagonal line (or/) |
/// | DiagonalDirectionLeft     | Left-leaning diagonal line (or\) |
/// @param width Frame width (range: 1-32000, unit: dot)
/// @param height Frame height (range: 1-32000, unit: dot)
/// @param thickness Border thickness (range: 1-32000, unit: dot)
/// @return XZPLCommand
- (XZPLCommand *)addGraphicDiagonalLineAtX:(int)x
                             y:(int)y
                   orientation:(DiagonalDirection)orientation
                         width:(int)width
                        height:(int)height
                     thickness:(int)thickness;


/// This function is used to draw a graphic ellipse
///
/// @param x Horizontal starting position
/// @param y Vertical starting position
/// @param width Ellipse width (range: 3-4095, unit: dot)
/// @param height Ellipse height (range: 3-4095, unit: dot)
/// @param thickness Border thickness (range: 2-4095, unit: dot)
/// @return XZPLCommand
- (XZPLCommand *)addGraphicEllipseAtX:(int)x
                        y:(int)y
                    width:(int)width
                   height:(int)height
                thickness:(int)thickness;

/// This function is used to print a circle
///
/// @param x Horizontal starting position
/// @param y Vertical starting position
/// @param diameter Circle diameter (range: 3-4095, unit: dot)
/// @param thickness Border thickness (range: 1-4095, unit: dot)
/// @return XZPLCommand
- (XZPLCommand *)addGraphicCircleAtX:(int)x
                       y:(int)y
                diameter:(int)diameter
               thickness:(int)thickness;

/// Add 1D Barcode
///
/// @param x Starting x value of the barcode
/// @param y Starting y value of the barcode
/// @param codeType Barcode type, see the specific ZPLBarCodeType enumeration
/// | Variable        | Description                                     |
/// |-----------------|--------------------------------------------------|
/// | ZPLBarCode11    | Code 11                                         |
/// | ZPLBarCode25    | Code 25                                         |
/// | ZPLBarCode39    | Code 39                                         |
/// | ZPLBarCodeEAN8  | EAN-8                                           |
/// | ZPLBarCodeUPCE  | UPC-E                                           |
/// | ZPLBarCode93    | Code 93                                         |
/// | ZPLBarCode128   | Code 128                                        |
/// | ZPLBarCodeEAN13 | EAN-13                                          |
/// | ZPLBarCodeCODA  | CODA (not standard, perhaps intended as CODABAR)|
/// | ZPLBarCodeMSI   | MSI                                             |
/// | ZPLBarCodePLESSEY | PLESSEY                                       |
/// | ZPLBarCodeUPCEAN | UPC-EAN (combination of UPC-A and EAN-13)      |
/// | ZPLBarCodeUPCA  | UPC-A                                           |
/// @param content Barcode text content
/// @return XZPLCommand
- (XZPLCommand *)addBarcodeAtX:(int)x
                 y:(int)y
          codeType:(ZPLBarCodeType)codeType
           content:(NSString *)content;

/// Add 1D Barcode
///
/// @param x Starting x value of the barcode
/// @param y Starting y value of the barcode
/// @param codeType Barcode type, see the specific ZPLBarCodeType enumeration
/// @param content Barcode text content
/// @param height Barcode height, default is 50 dots
/// @return XZPLCommand
- (XZPLCommand *)addBarcodeAtX:(int)x
                 y:(int)y
          codeType:(ZPLBarCodeType)codeType
           content:(NSString *)content
            height:(int)height;

/// Add 1D Barcode
///
/// @param x Starting x value of the barcode
/// @param y Starting y value of the barcode
/// @param codeType Barcode type, see the specific ZPLBarCodeType enumeration
/// @param ratio Rotation angle
/// @param textPosition Text position, default is ZPLHriTextBelow
/// | Variable       | Description                           |
/// |----------------|---------------------------------------|
/// | ZPLHriTextNone | No human readable text               |
/// | ZPLHriTextBelow| Human readable text below the barcode|
/// | ZPLHriTextAbove| Human readable text above the barcode|
/// @param content Barcode text content
/// @param width Barcode module width, default is 2 dots
/// @param height Barcode height, default is 50 dots
/// @return XZPLCommand
- (XZPLCommand *)addBarcodeAtX:(int)x
                 y:(int)y
          codeType:(ZPLBarCodeType)codeType
             ratio:(RotationZPL)ratio
      textPosition:(HriTextZPL)textPosition
           content:(NSString *)content
             width:(int)width
            height:(int)height;

/// Add 2D Barcode (QR Code)
///
/// @param x Starting x value of the QR code
/// @param y Starting y value of the QR code
/// @param factor Magnification factor, range 1~10, default is 3
/// @param text QR code content
/// @return XZPLCommand
- (XZPLCommand *)addQRCodeAtX:(int)x y:(int)y factor:(int)factor text:(NSString *)text;

/// Print Image
///
/// @param x Starting x value of the image
/// @param y Starting y value of the image
/// @param image Image object
/// @return XZPLCommand
- (XZPLCommand *)printImageAtX:(int)x y:(int)y image:(UIImage *)image;

/// Print Image
///
/// @param x Starting x value of the image
/// @param y Starting y value of the image
/// @param wRatio Width scaling ratio, range 1~10
/// @param hRatio Height scaling ratio, range 1~10
/// @param image Image object
/// @return XZPLCommand
- (XZPLCommand *)printImageAtX:(int)x y:(int)y wRatio:(int)wRatio hRatio:(int)hRatio image:(UIImage *)image;

/// Download Graphic
/// @param source Storage device for the image, default is DeviceTypeR, optional types see ZPLDeviceType
/// @param name Name of the stored image. Accepted values: 1 to 8 alphanumeric characters. If no name is specified, UNKNOWN is used.
/// @param image Image object
/// @return XZPLCommand
- (XZPLCommand *)downloadGraphic:(ZPLDeviceType)source name:(NSString *)name image:(UIImage *)image;

/// Call Graphic
/// @param x Starting x value of the image
/// @param y Starting y value of the image
/// @param source Storage device for the image, default is DeviceTypeR, optional types see ZPLDeviceType
/// @param name Name and extension obtained when downloading the image
/// @param mx Magnification factor in the x-axis direction, default is 1, range is 1~10
/// @param my Magnification factor in the y-axis direction, default is 1, range is 1~10
/// @return XZPLCommand
- (XZPLCommand *)printGraphicAtX:(int)x
                   y:(int)y
              source:(ZPLDeviceType)source
                name:(NSString *)name
                  mx:(int)mx
                  my:(int)my;

/// Delete Downloaded Graphic
/// @param source Storage device for the image, default is DeviceTypeR, optional types see ZPLDeviceType
/// @param name Name of the stored image. Accepted values: 1 to 8 alphanumeric characters. If no name is specified, UNKNOWN is used.
/// @return XZPLCommand
- (XZPLCommand *)deleteDownloadGraphic:(ZPLDeviceType)source name:(NSString *)name;

/// Set Print Quantity
///
/// @param count Number of labels
/// @return XZPLCommand
- (XZPLCommand *)addPrintCount:(int)count;

/// Set Print Speed
///
/// @param speed Print speed. Unit is inches/sec, range is 1~14
/// @return XZPLCommand
- (XZPLCommand *)setPrintSpeed:(int)speed;

/// This method is used to rotate the label format 180 degrees
///
/// @param n Rotate label YES=normal NO=rotate, default value: YES
/// @return XZPLCommand
- (XZPLCommand *)direction:(BOOL)n;

/// Set Print Density
///
/// @param density Print density (range: 0-30)
/// @return XZPLCommand
- (XZPLCommand *)setPrintDensity:(int)density;


@end
