//
//  XPOSCommand.h
//  PrinterSDK
//
//  Created by max on 2024/5/18.
//

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import "XConstants.h"

NS_ASSUME_NONNULL_BEGIN

/// ESC Command Class
@interface XPOSCommand : NSObject

#pragma mark - Basic related APIs

/// Get the Printing Command
///
/// This will retrieve the current ESC object's printing data
- (NSData*)getCommand;

/// Add Custom Data
///
/// @param customData Custom data content
/// @return XPOSCommand
- (XPOSCommand *)addData:(NSData *)customData;

/// Set Character Encoding
///
/// @param encoding Encoding format, default is GB_18030_2000
/// @return XPOSCommand
- (XPOSCommand *)setCharEncoding:(NSStringEncoding)encoding;

/// Initialize the Printer
///
/// Clear the print buffer data, and the print mode is set to the default mode at power-on
///
/// @return XPOSCommand
- (XPOSCommand *)initializePrinter;

/// Print and Line Feed
///
/// Print the data in the print buffer and advance the paper by one line according to the current line spacing
///
/// @return XPOSCommand
- (XPOSCommand *)lineFeed;

/// Print and Feed n Lines
///
/// Print the data in the buffer and advance the paper by n lines (character lines)
///
/// @param lines Number of lines
///
/// @return XPOSCommand
- (XPOSCommand *)printAndFeedLines:(int)lines;

/// Horizontal Tab
///
/// Move the print position to the next horizontal tab position
///
/// @return XPOSCommand
- (XPOSCommand *)setHorizontalTab;

/// Select Alignment
/// @param alignment Alignment mode
/// | Variable           | Description                |
/// |-------------------|----------------------------|
/// | POSAlignmentLeft   | Left alignment             |
/// | POSAlignmentCenter | Center alignment           |
/// | POSAlignmentRight  | Right alignment            |
/// @return XPOSCommand
- (XPOSCommand *)selectAlignment:(POSAlignment)alignment;

#pragma mark - Text related APIs

/// Add Text
///
/// The default character encoding format is GB_18030_2000
///
/// @param text Text content
/// @return XPOSCommand
- (XPOSCommand *)addText:(NSString *)text;

/// Set Text Size
///
/// Enlarge the width and height of the printed text characters
///
/// @param textSize Text font size, default is TextWidth1 | TextHeight1
/// @return XPOSCommand
- (XPOSCommand *)selectTextSize:(int)textSize;

#pragma mark - Compound Add Text (Support Alignment/Text Attributes/Character Width/Character Height)

/// Add Text
///
/// The default character encoding format is GB_18030_2000
///
/// @param text Character width ratio
/// @param align Text alignment, default is POSAlignmentLeft
/// @param attribute Text attribute, default is FntDefault
/// | Variable     | Description       |
/// |--------------|-------------------|
/// | FntDefault   | Standard font     |
/// | FntFontB     | FontB             |
/// | FntBold      | Bold              |
/// | FntReverse   | Reverse printing  |
/// | FntUnderline | Underline         |
/// | FntUnderline2| Double underline  |
/// @param textSize Text font size, default is TextWidth1 | TextHeight1
/// | Variable(Width Ratio) | Description |
/// |-------------------|--------------|
/// | TextWidth1        | Set width ratio to x1 |
/// | TextWidth2        | Set width ratio to x2 |
/// | TextWidth3        | Set width ratio to x3 |
/// | TextWidth4        | Set width ratio to x4 |
/// | TextWidth5        | Set width ratio to x5 |
/// | TextWidth6        | Set width ratio to x6 |
/// | TextWidth7        | Set width ratio to x7 |
/// | TextWidth8        | Set width ratio to x8 |
///
/// | Variable(Height Ratio)| Description |
/// |-------------------|--------------|
/// | TextHeight1       | Set height ratio to x1 |
/// | TextHeight2       | Set height ratio to x2 |
/// | TextHeight3       | Set height ratio to x3 |
/// | TextHeight4       | Set height ratio to x4 |
/// | TextHeight5       | Set height ratio to x5 |
/// | TextHeight6       | Set height ratio to x6 |
/// | TextHeight7       | Set height ratio to x7 |
/// | TextHeight8       | Set height ratio to x8 |
/// @return XPOSCommand
- (XPOSCommand *)addText:(NSString *)text alignment:(POSAlignment)align attribute:(POSFontType)attribute textSize:(int)textSize;

/// Add Text
///
/// The default character encoding format is GB_18030_2000
///
/// @param text Character width ratio
/// @param textSize TextWidth1 | TextHeight1
/// @return XPOSCommand
- (XPOSCommand *)addTextSize:(NSString *)text textSize:(int)textSize;

/// Add Text
///
/// The default character encoding format is GB_18030_2000
///
/// @param text Character width ratio
/// @param attribute Text attribute, default is FntDefault
/// @return XPOSCommand
- (XPOSCommand *)addTextAttribute:(NSString *)text attribute:(POSFontType)attribute;

/// Add Text
///
/// The default character encoding format is GB_18030_2000
///
/// @param text Character width ratio
/// @param align Text alignment, default is POSAlignmentLeft
/// @return XPOSCommand
- (XPOSCommand *)addTextAlignment:(NSString *)text alignment:(POSAlignment)align;

/// Select Font
/// @param font FontStandardASCII
/// | Variable             | Description                                        |
/// |--------------------|---------------------------------------------------|
/// | FontStandardASCII  | n = 0, 48 Select standard ASCII font (12 x 24)  |
/// | FontCompressedASCII| n = 1, 49 Select compressed ASCII font (9 x 17) |
/// @return XPOSCommand
- (XPOSCommand *)selectFont:(FontSelection)font;

/// Select International Character Set
/// @param charset Character set number (0~15), refer to POSCharacterSet for corresponding national character sets
/// | Variable                     | Description        |
/// |-----------------------------|--------------------|
/// | CharacterSetUSA              | USA                |
/// | CharacterSetFrance           | France             |
/// | CharacterSetGermany          | Germany            |
/// | CharacterSetUK               | UK                 |
/// | CharacterSetDenmarkI         | Denmark I          |
/// | CharacterSetSweden           | Sweden             |
/// | CharacterSetItaly            | Italy              |
/// | CharacterSetSpainI           | Spain I            |
/// | CharacterSetJapan            | Japan              |
/// | CharacterSetNorway           | Norway             |
/// | CharacterSetDenmarkII        | Denmark II         |
/// | CharacterSetSpainII          | Spain II           |
/// | CharacterSetLatinAmerica     | Latin America      |
/// | CharacterSetKorea            | Korea              |
/// | CharacterSetSloveniaCroatia  | Slovenia/Croatia   |
/// | CharacterSetChina            | China              |
/// @return XPOSCommand
- (XPOSCommand *)selectCharacter:(POSCharacterSet)charset;

/// Select/Cancel Underline Mode
///
/// Select or cancel underline mode according to the value of n
///
/// @param mode Mode
///
/// @return XPOSCommand
- (XPOSCommand *)selectOrCancelUnderlineMode:(int)mode;

/// Set Default Line Spacing
///
/// Select approximately 3.75mm line spacing
///
/// @return XPOSCommand
- (XPOSCommand *)setDefaultLineSpacing;

/// Set Line Spacing
///
/// Set line spacing to [n × vertical or horizontal motion unit] inches
///
/// @param spacing Spacing
///
/// @return XPOSCommand
- (XPOSCommand *)setLineSpacing:(int)spacing;

/// Select/Cancel Bold Mode
///
/// @param mode Mode
///
/// @return XPOSCommand
- (XPOSCommand *)selectOrCancelBoldMode:(int)mode;

/// Set Character Right Spacing
///
/// Set the right spacing of the character to [n × horizontal motion unit or vertical motion unit] inches
///
/// @param spacing Spacing
///
/// @return XPOSCommand
- (XPOSCommand *)setCharacterRightSpacing:(int)spacing;

#pragma mark - Image related APIs

/// Print Image
///
/// @param image Image source
/// @param type Image effect: Binarization, Dithering algorithm
/// @param mode Image scaling mode: Normal/Double Width/Double Height/Double Width and Height
/// @return XPOSCommand
- (XPOSCommand *)printImage:(UIImage *)image type:(BMPType)type mode:(BmpScaleType)mode;

/// Print Image via Compression Algorithm
///
/// Only models that support the compression algorithm can use this method, otherwise there may be printing garbled
///
/// @param image Image source
/// @param type Image effect: Binarization, Dithering algorithm
/// @param mode Image scaling mode: Normal/Double Width/Double Height/Double Width and Height
/// @return XPOSCommand
- (XPOSCommand *)compressionPrintImage:(UIImage *)image type:(BMPType)type mode:(BmpScaleType)mode;

/// Select Bitmap Mode
///
/// Select one of the bitmap modes specified by m, the number of bitmap dots is determined by nL and nH
///
/// @param mode Bitmap mode
/// @param width Width
/// @param image Bitmap
///
/// @return XPOSCommand
- (XPOSCommand *)selectBitmapMode:(int)mode width:(int)width image:(UIImage *)image;

/// Define Flash Bitmap
///
/// - Note:1. In the printer, the maximum flash download space is 8k bytes. This command can define multiple downloaded Flash bitmaps, but cannot define a bitmap larger than 8k bytes \
/// 2. Note that the download space is different for different printers, the above is just a reference, please refer to the printer configuration information \
/// 3. Frequent execution of this command may damage the Flash memory, it is recommended to write Flash no more than 10 times per day \
///
/// @param images Array containing bitmaps
/// @return XPOSCommand
- (XPOSCommand *)definedFlashBmpWithImage:(NSArray <UIImage *> *)images;

/// Print the Bitmap Downloaded to FLASH
///
/// Print the bitmap downloaded to FLASH in the mode specified by m
///
/// @param n Mode
/// @param m Mode
/// @return XPOSCommand
- (XPOSCommand *)printBitmapToFlashWithN:(int)n andM:(int)m;

/// Clear the BMP Stored in Flash
///
/// This command will clear all BMPs stored in Flash
/// @return XPOSCommand
- (XPOSCommand *)clearFlashBmp;

/// Define the Bitmap Downloaded to RAM
///
/// - Note: The downloaded bitmap will be cleared when the printer is reset or power is turned off
///
/// @param image Bitmap image
/// @param type Image effect
/// | Variable    | Description |
/// |-------------|-------------|
/// | BMPThreshold| Binarization|
/// | BMPDithering| Dithering   |
/// @return XPOSCommand
- (XPOSCommand *)defineDownloadedRAMBmp:(UIImage *)image bmpType:(BMPType)type;

/// Print the Bitmap Downloaded to RAM
///
/// Print a downloaded bitmap, print mode: Normal/Double Width/Double Height/Double Width and Height
///
/// @param mode Mode parameter
/// | Variable           | Description     |
/// |-------------------|-----------------|
/// | BmpNormal         | Original size   |
/// | BmpWidthDouble    | Double width    |
/// | BmpHeightDouble   | Double height   |
/// | BmpWidthHeightDouble| Double width and height |
/// @return XPOSCommand
- (XPOSCommand *)printDownloadRAMBmp:(BmpScaleType)mode;

#pragma mark - Barcode related APIs

/// Print Barcode
/// @param type Barcode type
/// | Variable           | Description     |
/// |-------------------|-----------------|
/// | POSBarcodeTypeUPCA    | UPC A           |
/// | POSBarcodeTypeUPCE    | UPCE            |
/// | POSBarcodeTypeJAN13_EAN13| JAN-13 | EAN-13 |
/// | POSBarcodeTypeJAN8_EAN8| JAN-8          |
/// | POSBarcodeTypeCode39  | Code 39         |
/// | POSBarcodeTypeITF     | ITF             |
/// | POSBarcodeTypeCodabar | Codabar         |
/// | POSBarcodeTypeCode93  | Code 93         |
/// | POSBarcodeTypeCode128 | Code 128        |
/// @param content Barcode content
/// @return XPOSCommand
- (XPOSCommand *)printBarcodeWithType:(POSBarcodeType)type andContent:(NSString *)content;

/// Select HRI Character Print Position
/// @param position Position parameter
/// @return XPOSCommand
- (XPOSCommand *)selectHRICharacterPrintPosition:(NSInteger)position;

/// Select HRI Font
/// @param font Font parameter
/// @return XPOSCommand
- (XPOSCommand *)selectHRIFont:(NSInteger)font;

/// Select Barcode Height
/// @param height Barcode height
/// @return XPOSCommand
- (XPOSCommand *)selectBarcodeHeight:(NSInteger)height;

/// Set Barcode Width
/// @param width Barcode width
/// @return XPOSCommand
- (XPOSCommand *)setBarcodeWidth:(NSInteger)width;

#pragma mark - Qrcode related APIs

/// Print QR Code
///
/// @param content QR code content
/// @return XPOSCommand
- (XPOSCommand *)printQRCodeWithContent:(NSString *)content;

/// Print QR Code
///
/// @param content QR code content
/// @param moduleSize Module size, range [1, 16], default is 8
/// @return XPOSCommand
- (XPOSCommand *)printQRCodeWithContent:(NSString *)content moduleSize:(NSInteger)moduleSize;

/// Print QR Code
///
/// @param content QR code content
/// @param moduleSize Module size, range [1, 16], default is 8
/// @param ecLevel Error correction level, default is QRErrorCorrectionLevelL
/// | Variable                | Description        |
/// |--------------------------|-------------------|
/// | QRErrorCorrectionLevelL | Error correction level L (7%)  |
/// | QRErrorCorrectionLevelM | Error correction level M (15%) |
/// | QRErrorCorrectionLevelQ | Error correction level Q (25%) |
/// | QRErrorCorrectionLevelH | Error correction level H (30%) |
/// @return XPOSCommand
- (XPOSCommand *)printQRCodeWithContent:(NSString *)content moduleSize:(NSInteger)moduleSize ecLevel:(QRErrorCorrectionLevel)ecLevel;


#pragma mark - Mode related APIs

/// Print and Return to Standard Mode (In Page Mode)
///
/// In page mode, print all the data in the print buffer and return to standard mode
///
/// @return XPOSCommand
- (XPOSCommand *)formFeed;

/// Cancel Print Data in Page Mode
///
/// In page mode, delete all print data in the current print area
///
/// @return XPOSCommand
- (XPOSCommand *)cancelPrintData;

/// Print in Page Mode
///
/// In page mode, print all the content in the print buffer
///
/// @return XPOSCommand
- (XPOSCommand *)pageModePrint;

/// Select Page Mode
///
/// Switch from standard mode to page mode
///
/// @return XPOSCommand
- (XPOSCommand *)selectPageMode;

/// Select Standard Mode
///
/// Set standard mode
///
/// @return XPOSCommand
- (XPOSCommand *)selectStandardMode;

/// Select Print Direction in Page Mode
///
/// @param direction Direction
///
///
/// @return XPOSCommand
- (XPOSCommand *)selectPrintDirection:(int)direction;

/// Set Absolute Print Position
///
/// Set the current position to a distance from the beginning of the line [(nL + nH × 256) × (horizontal or vertical motion unit)] inches
///
/// @param nL Low byte
/// @param nH High byte
/// @return XPOSCommand
- (XPOSCommand *)setAbsolutePrintPositionWithLow:(int)nL high:(int)nH;

/// Print and Feed Paper
///
/// Print the buffer data and feed the paper [n × vertical or horizontal motion unit] inches
///
/// @param lines Number of lines
///
/// @return XPOSCommand
- (XPOSCommand *)printAndFeedPaper:(int)lines;

/// Select/Cancel 90-degree Clockwise Rotation
///
/// rotation:0, 48 means cancel 90-degree clockwise rotation, rotation:1, 49 means select 90-degree clockwise rotation
///
/// @param rotation Rotation flag
///
///
/// @return XPOSCommand
- (XPOSCommand *)selectOrCancelRotation:(int)rotation;

/// Set Print Area in Page Mode
///
/// @param x Horizontal starting position, default is 0
/// @param y Vertical starting position, default is 0
/// @param width Area width
/// @param height Area height
/// @return XPOSCommand
- (XPOSCommand *)setPrintArea:(int)x y:(int)y width:(int)width height:(int)height;

/// Enable/Disable Keys
/// @param flag Flag
/// @return XPOSCommand
- (XPOSCommand *)enableOrDisableKeys:(int)flag;

/// Select Character Code Table
///
/// Select a page from the character code table
///
/// @param charset Code page number, see CharacterCodePage
/// ![This is an image](pos_codepage)
/// @return XPOSCommand
- (XPOSCommand *)selectCodePage:(CharacterCodePage)charset;

/// Select/Cancel Inverted Print Mode
/// @param mode Mode
/// @return XPOSCommand
- (XPOSCommand *)selectOrCancelInvertedPrint:(int)mode;

/// Set Relative Horizontal Print Position
///
/// Move the print starting position from the current position to [x * horizontal motion unit or vertical motion unit]
///
/// @param xPosition Horizontal relative displacement
/// @return XPOSCommand
- (XPOSCommand *)setRelativeHorizontal:(int)xPosition;

/// Set Absolute Vertical Position in Page Mode
///
/// @param yPosition Absolute vertical position
/// @return XPOSCommand
- (XPOSCommand *)setAbsoluteVertical:(NSInteger)yPosition;

/// Set Relative Vertical Position in Page Mode
///
/// @param yPosition Relative vertical position
/// @return XPOSCommand
- (XPOSCommand *)setRelativeVertical:(NSInteger)yPosition;

/// Set Horizontal and Vertical Motion Units
/// @param x Horizontal motion unit
/// @param y Vertical motion unit
/// @return XPOSCommand
- (XPOSCommand *)setMotionUnitsWithHorizontal:(NSInteger)x vertical:(NSInteger)y;

/// Select/Cancel Black/White Reverse Print Mode
/// @param mode Mode parameter
/// @return XPOSCommand
- (XPOSCommand *)selectCancelBWReversePrintMode:(NSInteger)mode;

/// Set Left Margin
/// @param left Left margin
/// @return XPOSCommand
- (XPOSCommand *)setLeftMargin:(NSInteger)left;

/// Select Paper Cut Mode and Cut Paper
///
/// Default is partial cut
/// @return XPOSCommand
- (XPOSCommand *)cutPaper;

/// Select Paper Cut Mode and Cut Paper
///
/// @param mode Paper cut mode: Default is partial cut
/// | Variable               | Description        |
/// |------------------------|-------------------|
/// | PaperCutModeFullCut    | Full cut (0, 48)   |
/// | PaperCutModeFullCutAlt | Full cut (0, 48) alternate |
/// | PaperCutModePartialCut | Partial cut (1, 49)|
/// | PaperCutModePartialCutAlt | Partial cut (1, 49) alternate |
/// @return XPOSCommand
- (XPOSCommand *)cutPaperWithMode:(PaperCutMode)mode;

/// Select Paper Cut Mode and Cut Paper
///
/// @param distance Feed distance, feed distance × (vertical motion unit) inches and partial cut
/// @return XPOSCommand
- (XPOSCommand *)cutPaperWithDistance:(NSInteger)distance;

/// Set Print Area Width
///
/// @param width Print area width
/// @return XPOSCommand
- (XPOSCommand *)setPrintAreaWidth:(int)width;


#pragma mark - Status related APIs

/// Real-time Status Transmission
///
/// Transmit the printer status in real-time, status is used to specify the printer status to be transmitted
///
/// @param status Status
/// | Variable                   | Description |
/// |----------------------------|-------------|
/// | PrinterStatusTypePrint     | Printing status |
/// | PrinterStatusTypeOffline   | Offline status |
/// | PrinterStatusTypeError     | Error status |
/// | PrinterStatusTypePaper     | Paper status |
/// @return XPOSCommand
- (XPOSCommand *)realTimeStatus:(PrinterAllStatusType)status;

/// Return Status
/// @param statusType Status type
/// @return XPOSCommand
- (XPOSCommand *)returnStatus:(NSInteger)statusType;

#pragma mark - Buzzer/Alarm related APIs

/// Printer Receives Order Beep (Applicable to XP-80XX series)
///
/// @param count Buzzer beep count, range (1~9)
/// @param time Beep duration for each time, range (1~9), each beep duration is time *50ms
/// @return XPOSCommand
- (XPOSCommand *)printerBeep:(NSInteger)count time:(NSInteger)time;

/// Printer Receives Order Beep and Alarm Light Flashing (Applicable to XP-80XX series)
///
/// @param count Range 1~20, indicating the number of alarm light flashes or buzzer beeps
/// @param interval Range 1~20, indicating the alarm light flash interval time is interval *50ms, or the buzzer beep time is interval *50ms
/// @param mode Mode
/// | Variable         | Description                                |
/// |------------------|-------------------------------------------|
/// | AlarmStateNone   | Buzzer does not beep, and the alarm light does not flash |
/// | AlarmStateBuzzer | Buzzer beeps                              |
/// | AlarmStateLight  | Alarm light flashes                       |
/// | AlarmStateBoth   | Buzzer beeps, and the alarm light flashes |
/// @return XPOSCommand
- (XPOSCommand *)printerBeepAndFlashAlarm:(NSInteger)count count:(NSInteger)interval time:(AlarmState)mode;

/// This method is used to open the cash drawer
///
/// @param pinNum Pin number connected, see CashDrawerPin
/// | Variable          | Description                 |
/// |-------------------|----------------------------|
/// | CashDrawerPin2    | Cash drawer socket pin 2 (0, 48) |
/// | CashDrawerPin2Alt | Cash drawer socket pin 2 (0, 48) alternate |
/// | CashDrawerPin5    | Cash drawer socket pin 5 (1, 49) |
/// | CashDrawerPin5Alt | Cash drawer socket pin 5 (1, 49) alternate |
/// @return XPOSCommand
- (XPOSCommand *)openCashBoxWithPinNumber:(CashDrawerPin)pinNum;

/// This method is used to open the cash drawer
///
/// @param pinNum Pin number connected, see CashDrawerPin
/// @param onTime Cash drawer pulse start time onTime*2ms, range [0, 255]. Default is 30
/// @param offTime Cash drawer pulse end time offTime*2ms, range [0, 255], default is 255. If onTime>offTime, the end time is onTime*2ms
/// @return XPOSCommand
- (XPOSCommand *)openCashBoxWithPinNumber:(CashDrawerPin)pinNum onTime:(int)onTime offTime:(int)offTime;

@end

NS_ASSUME_NONNULL_END
