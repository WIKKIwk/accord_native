//
//  XTSPLCommand.h
//  PrinterSDK
//
//  Created by max on 2024/5/18.
//

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import "XConstants.h"
/// TSPL Command Class
@interface XTSPLCommand : NSObject

/// Get Print Command
///
/// Retrieve the print data of the current TSPL object
- (NSData*)getCommand;

/// Set Character Encoding
///
/// @param encoding Encoding format
/// @return XTSPLCommand
- (XTSPLCommand *)setCharEncoding:(NSStringEncoding)encoding;

/// Add Custom Data
///
/// @param customData Custom data content
/// @return XTSPLCommand
- (XTSPLCommand *)addData:(NSData *)customData;

#pragma mark - Size Commands

/// Set Label Size
///
/// Size unit is inches
///
/// @param width Size width
/// @param height Size height
/// @return XTSPLCommand
- (XTSPLCommand *)sizeInch:(double)width height:(double)height;

/// Set Label Size
///
/// Size unit is mm
///
/// @param width Size width
/// @param height Size height
/// @return XTSPLCommand
- (XTSPLCommand *)sizeMm:(double)width height:(double)height;

#pragma mark - Gap Command

/// Define the Gap Height Between Two Labels
///
/// Unit is inches
///
/// @param m Gap height
/// @param n Gap height compensation value
/// ![This is an image](tspl_gap)
/// @return XTSPLCommand
- (XTSPLCommand *)gapInch:(double)m n:(double)n;

/// Define the Gap Height Between Two Labels
///
/// Unit is mm
///
/// @param m Gap height
/// @param n Gap height compensation value
/// @return XTSPLCommand
- (XTSPLCommand *)gapMm:(double)m n:(double)n;

#pragma mark - Speed and Density Commands

/// Set Printer Print Speed
///
/// Print speed in inches per second
///
/// @param speed Print speed
/// @return XTSPLCommand
- (XTSPLCommand *)speed:(double)speed;

/// Set Printer Print Density
///
/// Density, range [0, 15]
///
/// @param density Density
/// @return XTSPLCommand
- (XTSPLCommand *)density:(int)density;

#pragma mark - Control Commands

/// Clear Print Buffer
///
/// Clear the printer buffer and reset the printer to its initial state
/// @return XTSPLCommand
- (XTSPLCommand *)cls;

/// Set Label Paper Offset
///
/// Unit is inches
///
/// @param offset Offset
/// @return XTSPLCommand
- (XTSPLCommand *)offsetInch:(double)offset;

/// Set Label Paper Offset
///
/// Unit is mm
///
/// @param offset Offset
/// @return XTSPLCommand
- (XTSPLCommand *)offsetMm:(double)offset;

/// Set Printer Print Direction
///
/// @param direction Print direction
/// ![This is an image](tspl_direction)
/// @return XTSPLCommand
- (XTSPLCommand *)direction:(DirectionTSPL)direction;

/// Set Printer Print Direction, Can Set Whether to Mirror
///
/// @param direction Print direction
/// @param isMirror Whether to mirror
/// @return XTSPLCommand
- (XTSPLCommand *)direction:(DirectionTSPL)direction isMirror:(BOOL)isMirror;

/// Feed Forward
///
/// Advance the label paper by the corresponding length
///
/// @param length Feed length, unit is dot. Range [1, 9999]
/// @return XTSPLCommand
- (XTSPLCommand *)feed:(int)length;

/// Define the Origin Coordinates of the Label Paper
///
/// @param x Horizontal coordinate, unit is dot
/// @param y Vertical coordinate, unit is dot
/// ![This is an image](reference)
/// @return XTSPLCommand
- (XTSPLCommand *)referenceAtX:(int)x y:(int)y;

/// Move the Vertical Position of the Label Image
///
/// @param n Vertical coordinate of the label image, unit is dot, the maximum size that can be set is 1 inch
/// @return XTSPLCommand
- (XTSPLCommand *)shift:(int)n;

#pragma mark - Print Commands

/// Print a Bar at the Specified Position
///
/// @param x Bar starting horizontal coordinate, unit is dot
/// @param y Bar starting vertical coordinate, unit is dot
/// @param width Bar width, unit is dot
/// @param height Bar height, unit is dot
/// @return XTSPLCommand
- (XTSPLCommand *)barAtX:(int)x andY:(int)y width:(int)width height:(int)height;

/// Print a Box at the Specified Position
///
/// @param x Box upper left X coordinate
/// @param y Box upper left Y coordinate
/// @param width Box width
/// @param height Box height
/// @param thickness Border thickness
/// @return XTSPLCommand
- (XTSPLCommand *)boxAtX:(int)x y:(int)y width:(int)width height:(int)height thickness:(int)thickness;

/// Draw an Ellipse
/// @param x Specify the X coordinate of the upper left corner (unit DOT)
/// @param y Specify the Y coordinate of the upper left corner (unit DOT)
/// @param width Specify the width of the ellipse (unit DOT)
/// @param height Specify the height of the ellipse (unit DOT)
/// @param thickness Ellipse line thickness (unit DOT)
/// @return XTSPLCommand
- (XTSPLCommand *)ellipseAtX:(int)x andY:(int)y andWidth:(int)width andHeight:(int)height andThickness:(int)thickness;

/// Label Backfeed
///
/// Pull the label paper back the specified length
///
/// @param length Backfeed length, unit is dot. Range [1, 9999]
/// @return XTSPLCommand
- (XTSPLCommand *)backFeed:(int)length;

/// Print and Feed Forward to the Next Label
///
/// Feed the label paper forward the distance of one label
/// @return XTSPLCommand
- (XTSPLCommand *)formFeed;

/// Print and Feed Forward to the Label Starting Position
///
/// Calibrate the label position
/// @return XTSPLCommand
- (XTSPLCommand *)home;

/// Print Label
///
/// This command is used to print the image cached in the printer, default to print 1 copy, no reprinting
/// @return XTSPLCommand
- (XTSPLCommand *)print;

/// Print Label
///
/// This command is used to print the image cached in the printer
/// @param m Specify how many sets of labels to print
/// @param n Print how many copies of each set
/// @return XTSPLCommand
- (XTSPLCommand *)print:(int)m n:(int)n;

/// Print Label with Task ID
///
/// This command is used to print the image cached in the printer,
/// and associates the print operation with a specific task ID.
///
/// @param m Specify how many sets of labels to print
/// @param n Print how many copies of each set
/// @param taskId A string identifier for the print task (optional)
/// @return XTSPLCommand
- (XTSPLCommand *)print:(int)m n:(int)n taskId:(NSString *)taskId;

#pragma mark - Barcode Commands

/// Print Barcode at Specified Position
/// @param x Barcode starting horizontal coordinate, unit is dot
/// @param y Barcode starting vertical coordinate, unit is dot
/// @param codeType Barcode type, available types refer to Barcode Code Types in XConstants.h
/// | Variable                   | Description                                        |
/// |------------------------|-----------------------------------------------------|
/// | kBarcodeTypeCode128     | Code 128, auto switch code subset.                  |
/// | kBarcodeTypeCode128Manual | Code 128, manual switch code subset.              |
/// | kBarcodeTypeEAN128      | EAN128, auto switch code subset.                   |
/// | kBarcodeTypeInterleaved25 | Interleaved 2 of 5.                              |
/// | kBarcodeTypeInterleaved25C | Interleaved 2 of 5 with check digit.            |
/// | kBarcodeTypeCode39      | Code 39, auto switch standard and full ASCII mode. |
/// | kBarcodeTypeCode39C     | Code 39 with check digit.                          |
/// | kBarcodeTypeCode93      | Code 93.                                           |
/// | kBarcodeTypeEAN13       | EAN 13.                                            |
/// | kBarcodeTypeEAN13_2     | EAN 13 with 2-digit add-on.                        |
/// | kBarcodeTypeEAN13_5     | EAN 13 with 5-digit add-on.                        |
/// | kBarcodeTypeEAN8        | EAN 8.                                             |
/// | kBarcodeTypeEAN8_2      | EAN 8 with 2-digit add-on.                         |
/// | kBarcodeTypeEAN8_5      | EAN 8 with 5-digit add-on.                         |
/// | kBarcodeTypeCodabar     | Codabar.                                           |
/// | kBarcodeTypePostnet     | Postnet.                                           |
/// | kBarcodeTypeUPCA        | UPC-A.                                             |
/// | kBarcodeTypeUPCA_2      | UPC-A with 2-digit add-on.                         |
/// | kBarcodeTypeUPCA_5      | UPC-A with 5-digit add-on.                         |
/// | kBarcodeTypeUPCE        | UPC-E.                                             |
/// | kBarcodeTypeUPCE_2      | UPC-E with 2-digit add-on.                         |
/// | kBarcodeTypeUPCE_5      | UPC-E with 5-digit add-on.                         |
/// | kBarcodeTypeCpost       | China post.                                        |
/// | kBarcodeTypeMSI         | MSI.                                               |
/// | kBarcodeTypeMSIC        | MSI with check digit.                              |
/// | kBarcodeTypePlessey     | PLESSEY.                                           |
/// | kBarcodeTypeITF14       | ITF14.                                             |
/// | kBarcodeTypeEAN14       | EAN14.                                             |
/// | kBarcodeTypeCode11      | Code 11.                                           |
/// | kBarcodeTypeTelepen     | Telepen.                                           |
///
/// @param height Barcode height, unit is dot
/// @param readable Whether to print readable characters, default is ReadableTypeLeft, displayed on the left
/// @param narrow Narrow bar code ratio factor, unit is dot, default is 2
/// @param wide Wide bar code ratio factor, unit is dot, default is 2
/// @param content Barcode content
/// @return XTSPLCommand
- (XTSPLCommand *)barcodeAtX:(int)x
              y:(int)y
       codeType:(NSString *)codeType
         height:(int)height
       readable:(ReadableType)readable
    andRotation:(TSPLRotation)rotation
         narrow:(int)narrow
           wide:(int)wide
        content:(NSString *)content;

/// Draw CODABLOCK F Type Barcode
///
/// CODABLOCK bar code module height (default is 8), CODABLOCK narrow bar code ratio width (unit DOT, default is 2)
///
/// @param x Specify X coordinate
/// @param y Specify Y coordinate
/// @param rotation Rotation angle
/// @param content CODABLOCK barcode content
/// @return XTSPLCommand
- (XTSPLCommand *)codaBlockFAtX:(int)x andY:(int)y andRotation:(TSPLRotation)rotation andContent:(NSString *)content;

#pragma mark - Sound and Code Page Commands

/// Set Printer International Code Page
///
/// @param code Code page name, refer to codepage code in XConstants.h
/// ![This is an image](tspl_codepage)
/// @return XTSPLCommand
- (XTSPLCommand *)codePage:(NSString *)code;

/// Set Printer Buzzer Beep Times and Interval
///
/// @param level Sound volume: 0~9
/// @param interval Sound interval: 1~4095
/// @return XTSPLCommand
- (XTSPLCommand *)sound:(int)level interval:(int)interval;

#pragma mark - Set Commands

/// Select International Character Set
///
/// Available character sets, refer to country code in XConstants.h
/// @return XTSPLCommand
- (XTSPLCommand *)country:(NSString *)code;

#pragma mark - Limit Feed Commands

/// Limit Forward Feed
/// @param length Limit length
/// @return XTSPLCommand
- (XTSPLCommand *)limitFeedInch:(double)length;

/// Limit Forward Feed
/// @param length Limit length
/// @return XTSPLCommand
- (XTSPLCommand *)limitFeedMm:(double)length;

#pragma mark - Bitmap Commands

/// Print Bitmap
/// @param x Bitmap upper left X coordinate
/// @param y Bitmap upper left Y coordinate
/// @param mode Bitmap mode: Only supports these three modes: BMPModeOverwrite, BMPModeOR, BMPModeXOR
/// @param image Bitmap object
/// @return XTSPLCommand
- (XTSPLCommand *)bitmapAtX:(int)x y:(int)y mode:(BMPMode)mode image:(UIImage *)image;

/// Transfer Compressed Image to Printer, Applicable to Some Models Only
///
/// - Note: Only supported by some models, when using this command, please make sure the current printer supports compressed image transmission
///
/// @param x Bitmap upper left X coordinate
/// @param y Bitmap upper left Y coordinate
/// @param mode Bitmap mode: Only supports these three modes: BMPModeOverwriteZlib, BMPModeORZlib, BMPModeXORZlib, other modes default to no compression
/// @param image Bitmap object
/// @return XTSPLCommand
- (XTSPLCommand *)zlibBitmapAtX:(int)x y:(int)y mode:(BMPMode)mode image:(UIImage *)image;


/// Print BMP Format Image
///
/// @param x BMP image X coordinate
/// @param y BMP image Y coordinate
/// @param filename Downloaded BMP image name (supports ZPL *.GRF files)
/// @return XTSPLCommand
- (XTSPLCommand *)putBmpAtX:(int)x andY:(int)y andFileName:(NSString *)filename;

/// Print BMP Format Image
///
/// @param x BMP image X coordinate
/// @param y BMP image Y coordinate
/// @param filename Downloaded BMP image name (supports ZPL *.GRF files)
/// @param contrast Grayscale contrast ratio, default is 80, recommended range is 60 to 100
/// @return XTSPLCommand
- (XTSPLCommand *)putBmpAtX:(int)x andY:(int)y andFileName:(NSString *)filename contrast:(int)contrast;

/// Print PCX Format Image
///
/// @param x PCX image X coordinate
/// @param y PCX image Y coordinate
/// @param filename Downloaded PCX image name (case sensitive)
/// @return XTSPLCommand
- (XTSPLCommand *)putPcxAtX:(int)x andY:(int)y andFileName:(NSString *)filename;

#pragma mark - QR Code Commands

/// Print QR Code at Specified Position
///
/// @param x QR code upper left X coordinate
/// @param y QR code upper left Y coordinate
/// @param ecclevel Error correction level: kECLevelL:7%, kECLevelM:15%, kECLevelQ:25%, kECLevelH:30%
/// @param cellwidth QR code cell size, range [1, 10]
/// @param mode QR code encoding mode: kQRCodeModeAuto:auto generate encoding, kQRCodeModeManual:manual generate encoding
/// @param rotation Rotation angle [0, 90, 180, 270]
/// @param content QR code content
/// @return XTSPLCommand
- (XTSPLCommand *)qrCodeAtX:(int)x
          andY:(int)y
       ecLevel:(NSString *)ecclevel
     cellWidth:(int)cellwidth
          mode:(NSString *)mode
      rotation:(TSPLRotation)rotation
          content:(NSString *)content;

/// Draw DataMatrix 2D Barcode
///
/// @param x Specify X coordinate (unit DOT)
/// @param y Specify Y coordinate (unit DOT)
/// @param width Barcode area width (unit DOT)
/// @param height Barcode area height (unit DOT)
/// @param content DataMatrix data content
/// @return XTSPLCommand
- (XTSPLCommand *)dataMatrixAtX:(int)x
           andY:(int)y
          width:(int)width
         height:(int)height
           content:(NSString *)content;

/// Draw PDF417 2D Barcode
///
/// @param x Specify X coordinate (unit DOT)
/// @param y Specify Y coordinate (unit DOT)
/// @param width Expected width (unit DOT)
/// @param height Expected height (unit DOT)
/// @param rotate Counterclockwise rotation (0,90,180,270)
/// @param content PDF417 barcode data content
/// @return XTSPLCommand
- (XTSPLCommand *)pdf417AtX:(int)x
             y:(int)y
         width:(int)width
        height:(int)height
        rotate:(TSPLRotation)rotate
       content:(NSString *)content;


#pragma mark - Text Commands

/// Print Text at Specified Position
///
/// @param x Text upper left X coordinate
/// @param y Text upper left Y coordinate
/// @param font Font name, available font names refer to Font name in XConstants.h
/// @param content Text content
/// @return XTSPLCommand
- (XTSPLCommand *)textAtX:(int)x y:(int)y font:(NSString *)font content:(NSString *)content;

/// Print Text at Specified Position
///
/// @param x Text upper left X coordinate
/// @param y Text upper left Y coordinate
/// @param font Font name, available font names refer to Font name in XConstants.h
/// @param xRatio Text horizontal magnification ratio, range [1, 10]
/// @param yRatio Text vertical magnification ratio, range [1, 10]
/// @param content Text content
/// @return XTSPLCommand
- (XTSPLCommand *)textAtX:(int)x y:(int)y font:(NSString *)font xRatio:(int)xRatio yRatio:(int)yRatio content:(NSString *)content;

/// Print Text at Specified Position
///
/// ```swift
///  let command = XTSPLCommand()
/// command
/// .sizeMm(70, height: 85)
/// .gapMm(2, n: 0)
/// .cls()
/// .textAt(x: 0, y: 50, font: kFNT_8_12, rotation: .rotation0, xRatio: 1, yRatio: 1, content: "kFNT_8_12")
/// .textAt(x: 0, y: 100, font: kFNT_12_20, rotation: .rotation0, xRatio: 1, yRatio: 1, content: "kFNT_12_20")
/// .textAt(x: 0, y: 150, font: kFNT_16_24, rotation: .rotation0, xRatio: 1, yRatio: 1, content: "kFNT_16_24")
/// .textAt(x: 0, y: 200, font: kFNT_24_32, rotation: .rotation0, xRatio: 1, yRatio: 1, content: "kFNT_24_32")
/// .textAt(x: 0, y: 250, font: kFNT_32_48, rotation: .rotation0, xRatio: 1, yRatio: 1, content: "kFNT_32_48")
/// .textAt(x: 0, y: 300, font: kFNT_14_19, rotation: .rotation0, xRatio: 1, yRatio: 1, content: "kFNT_14_19")
/// .textAt(x: 0, y: 350, font: kFNT_14_25, rotation: .rotation0, xRatio: 1, yRatio: 1, content: "kFNT_14_25")
/// .textAt(x: 0, y: 400, font: kFNT_21_27, rotation: .rotation0, xRatio: 1, yRatio: 1, content: "kFNT_21_27")
/// .print()
/// ````
///
/// @param x Text upper left X coordinate
/// @param y Text upper left Y coordinate
/// @param font Font name, common font names refer to Font name in XConstants.h
/// Variable | Description
/// --- | ---
/// FNT_8_12 | 8 x 12 alphanumeric font
/// FNT_12_20 | 12 x 20 alphanumeric font
/// FNT_16_24 | 16 x 24 alphanumeric font
/// FNT_24_32 | 24 x 32 alphanumeric font
/// FNT_32_48 | 32 x 48 alphanumeric font
/// FNT_14_19 | 14 x 19 alphanumeric font OCR-B
/// FNT_14_25 | 14 x 25 alphanumeric font OCR-A
/// FNT_21_27 | 21 x 27 alphanumeric font OCR-B
/// FNT_SIMPLIFIED_CHINESE | Simplified Chinese 24x24 font (GB code)
/// FNT_TRADITIONAL_CHINESE | Traditional Chinese 24x24 font (Big5 code)
/// FNT_KOREAN | Korean 24x24 font (KS code)
///
/// @param rotation Rotation angle [0, 90, 180, 270]
/// @param xRatio Text horizontal magnification ratio, range [1, 10]
/// @param yRatio Text vertical magnification ratio, range [1, 10]
/// @param content Text content
/// @return XTSPLCommand
- (XTSPLCommand *)textAtX:(int)x y:(int)y font:(NSString *)font rotation:(TSPLRotation)rotation xRatio:(int)xRatio yRatio:(int)yRatio content:(NSString *)content;

/// Print Paragraph of Text at Specified Position
///
/// @param x Text X starting coordinate
/// @param y Text Y starting coordinate
/// @param width Text Y starting coordinate
/// @param height Text Y starting coordinate
/// @param font Font name, available common font names refer to Font name in XConstants.h
/// @param rotaion Text rotation direction (0,90,180,270)
/// @param x_mul Horizontal magnification ratio, maximum 10x, range [1, 10]
/// @param y_mul Vertical magnification ratio, maximum 10x, range [1, 10]
/// @param content Text content
/// @return XTSPLCommand
- (XTSPLCommand *)textBlockAtX:(int)x
                 y:(int)y
               width:(int)width
              height:(int)height
                font:(NSString *)font
             rotaion:(TSPLRotation)rotaion
               x_mul:(int)x_mul
               y_mul:(int)y_mul
          content:(NSString *)content;

#pragma mark - Erase and Reverse Commands

/// Erase Content in Specified Area
/// @param x Area upper left X coordinate
/// @param y Area upper left Y coordinate
/// @param width Area width
/// @param height Area height
/// @return XTSPLCommand
- (XTSPLCommand *)eraseAtX:(int)x y:(int)y width:(int)width height:(int)height;

/// Reverse Print Content in Specified Area
/// @param x Area upper left X coordinate
/// @param y Area upper left Y coordinate
/// @param width Area width
/// @param height Area height
/// @return XTSPLCommand
- (XTSPLCommand *)reverseAtX:(int)x y:(int)y width:(int)width height:(int)height;

#pragma mark - Cut and Peel Commands

/// Perform Paper Cutting
/// @return XTSPLCommand
- (XTSPLCommand *)cut;

/// Set Peel Mode
/// @param isOpen Whether to enable peel mode
/// @return XTSPLCommand
- (XTSPLCommand *)setPeel:(BOOL)isOpen;

/// Set Tear Mode
/// @param isOpen Whether to enable tear mode
/// @return XTSPLCommand
- (XTSPLCommand *)setTear:(BOOL)isOpen;

/// Set Cutter Working Mode
///
/// ```swift
///  setCutter(0) // Disable cutter function
///  setCutter(-1) // Set the printer to cut after the entire print job is finished
///  setCutter(1) // Set to cut 1 label at a time
/// ```
///
/// @param pieces 0:Disable cutter function,-1:Set the printer to cut after the entire print job is finished,pieces >= 1:Set to cut multiple labels at a time 1<= pieces <=65535
/// @return XTSPLCommand
- (XTSPLCommand *)setCutter:(int)pieces;

#pragma mark - Bline Commands

/// Set Black Mark Spacing
///
/// Set the black mark height and the additional length of paper to be fed out after the label is printed, unit is inch
///
/// @param m Black mark height, range: [0.1, 1] feet or [2.54, 25.4] mm
/// @param n Additional paper feed length. Range [0, label length]
/// @return XTSPLCommand
- (XTSPLCommand *)blineInch:(double)m n:(double)n;

/// Set Black Mark Spacing
///
/// Set the black mark height and the additional length of paper to be fed out after the label is printed, unit is mm
///
/// @param m Black mark height, range: [0.1, 1] feet or [2.54, 25.4] mm
/// @param n Additional paper feed length. Range [0, label length]
/// @return XTSPLCommand
- (XTSPLCommand *)blineMm:(double)m n:(double)n;


#pragma mark - Other Commands

/// Gap Calibration
///
/// Feed the paper through the gap sensor to determine the size of the paper and the gap
/// @return XTSPLCommand
- (XTSPLCommand *)gapDetect;

/// Black Mark Calibration
///
/// Distinguish the size of the paper and the black mark by the difference in intensity detected by the black mark sensor
/// @return XTSPLCommand
- (XTSPLCommand *)blinedDetect;

/// Auto Calibration
///
/// Distinguish the size of the paper and the gap/black mark by the difference in intensity detected by the gap sensor/black mark sensor
/// @return XTSPLCommand
- (XTSPLCommand *)autoDetect;

/// This command will restore the printer to factory settings, use with caution
///
/// - Note: Note: Please distinguish it from the initializePrinter method of XESCCommand
/// @return XTSPLCommand
- (XTSPLCommand *)initialPrinter;

/// This command can move files from DRAM to FLASH
/// @return XTSPLCommand
- (XTSPLCommand *)move;

/// This command will print the current total memory capacity and available memory capacity (including FLASH and DRAM)
/// @return XTSPLCommand
- (XTSPLCommand *)files;

/// Delete files in DRAM
///
/// ```swift
///  killDRAM("FILENAME") // Delete the corresponding file in DRAM
///  killDRAM("*.PCX") // Delete all PCX files in DRAM
///  killDRAM("*") // Delete all files in DRAM
/// ```
/// @param filename File name
/// @return XTSPLCommand
- (XTSPLCommand *)killDRAM:(NSString *)filename;

/// Delete files in built-in FLASH
///
/// ```swift
///  killFLASH("FILENAME") // Delete the corresponding file in FLASH
///  killFLASH("*.PCX") // Delete all PCX files in FLASH
///  killFLASH("*") // Delete all files in FLASH
/// ```
/// @param filename File name
/// @return XTSPLCommand
- (XTSPLCommand *)killFLASH:(NSString *)filename;

/// Set Printer Auto Response
///
/// @param mode Mode options: ON/OFF/BATCH
/// @return XTSPLCommand
- (XTSPLCommand *)autoResponse:(AutoResMode)mode;

@end
