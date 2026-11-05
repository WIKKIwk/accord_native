//
//  XConstants.h
//  PrinterSDK
//
//  Created by max on 2024/5/18.
//

#import <Foundation/Foundation.h>

#pragma mark - Common ENUM

/// Label Command Type
typedef NS_ENUM(NSInteger, PrintCommandType) {
    PrintCommandTsplPrint = 0,   ///< TSPL Print Command
    PrintCommandZplPrint,        ///< ZPL Print Command
    PrintCommandCpclPrint,       ///< CPCL Print Command
};

/// Image Effect
typedef NS_ENUM (NSUInteger,BMPType) {
    BMPThreshold,  ///< Threshold
    BMPDithering,  ///< Dithering Algorithm
};

#pragma mark - ESC&POS ENUM

/// POS Receipt Content Alignment
typedef NS_ENUM(NSInteger, POSAlignment) {
    POSAlignmentLeft = 0,       ///< Left Alignment
    POSAlignmentCenter,         ///< Center Alignment
    POSAlignmentRight           ///< Right Alignment
};

/// POS Font Type
typedef NS_ENUM(NSInteger, POSFontType) {
    FntDefault = 0,   /// Default Font
    FntFontB,         /// FontB
    FntBold,          /// Bold Font
    FntReverse,       /// Reverse Print
    FntUnderline,     /// Underline
    FntUnderline2     /// Double Underline
};

/// POS Font Selection
typedef NS_ENUM(NSUInteger, FontSelection) {
    FontStandardASCII = 0, // n = 0, 48 Select Standard ASCII Font (12 x 24)
    FontCompressedASCII = 1 // n = 1, 49 Select Compressed ASCII Font (9 x 17)
};

/// POS Paper Cut Mode
typedef NS_ENUM(NSUInteger, PaperCutMode) {
    PaperCutModeFullCut = 0,          ///< Full Cut (0, 48)
    PaperCutModeFullCutAlt = 48,      ///< Full Cut (0, 48) Alternative
    PaperCutModePartialCut = 1,       ///< Partial Cut (1, 49)
    PaperCutModePartialCutAlt = 49,   ///< Partial Cut (1, 49) Alternative
};

/// POS Drawer Pin
typedef NS_ENUM(NSUInteger, CashDrawerPin) {
    CashDrawerPin2 = 0,   ///< Drawer Pin 2 (0, 48)
    CashDrawerPin2Alt = 48, ///< Drawer Pin 2 (0, 48) Alternative
    CashDrawerPin5 = 1,   ///< Drawer Pin 5 (1, 49)
    CashDrawerPin5Alt = 49  ///< Drawer Pin 5 (1, 49) Alternative
};

/// POS Character Set
typedef NS_ENUM(NSUInteger, POSCharacterSet) {
    CharacterSetUSA = 0,            // USA
    CharacterSetFrance = 1,         // France
    CharacterSetGermany = 2,        // Germany
    CharacterSetUK = 3,             // UK
    CharacterSetDenmarkI = 4,       // Denmark I
    CharacterSetSweden = 5,         // Sweden
    CharacterSetItaly = 6,          // Italy
    CharacterSetSpainI = 7,         // Spain I
    CharacterSetJapan = 8,          // Japan
    CharacterSetNorway = 9,         // Norway
    CharacterSetDenmarkII = 10,     // Denmark II
    CharacterSetSpainII = 11,       // Spain II
    CharacterSetLatinAmerica = 12,  // Latin America
    CharacterSetKorea = 13,         // Korea
    CharacterSetSloveniaCroatia = 14, // Slovenia/Croatia
    CharacterSetChina = 15          // China
};

/// POS codepage
typedef NS_ENUM(NSUInteger, CharacterCodePage) {
    CharacterCodePagePC437_StdEurope = 0,          ///< PC437(Std.Europe)
    CharacterCodePageKatakana = 1,                 ///< Katakana
    CharacterCodePagePC850_Multilingual = 2,       ///< PC850(Multilingual)
    CharacterCodePagePC860_Portugal = 3,           ///< PC860(Portugal)
    CharacterCodePagePC863_Canadian = 4,           ///< PC863(Canadian)
    CharacterCodePagePC865_Nordic = 5,             ///< PC865(Nordic)
    CharacterCodePageWestEurope = 6,               ///< West Europe
    CharacterCodePageGreek = 7,                    ///< Greek
    CharacterCodePageHebrew = 8,                   ///< Hebrew
    CharacterCodePageEastEurope = 9,               ///< East Europe
    CharacterCodePageIran = 10,                    ///< Iran
    CharacterCodePageWPC1252 = 16,                 ///< WPC1252
    CharacterCodePagePC866_Cyrillic2 = 17,         ///< PC866(Cyrillic#2)
    CharacterCodePagePC852_Latin2 = 18,            ///< PC852(Latin2)
    CharacterCodePagePC858 = 19,                   ///< PC858
    CharacterCodePageIranII = 20,                  ///< IranII
    CharacterCodePageLatvian = 21,                 ///< Latvian
    CharacterCodePageArabic = 22,                  ///< Arabic
    CharacterCodePagePT1511251 = 23,               ///< PT1511251
    CharacterCodePagePC747 = 24,                   ///< PC747
    CharacterCodePageWPC1257 = 25,                 ///< WPC1257
    CharacterCodePageVietnam = 27,                 ///< Vietnam
    CharacterCodePagePC864 = 28,                   ///< PC864
    CharacterCodePagePC1001 = 29,                  ///< PC1001
    CharacterCodePageUigur = 30,                   ///< Uigur
    CharacterCodePageHebrewAlt = 31,               ///< Hebrew
    CharacterCodePageWPC1255_Israel = 32,          ///< WPC1255(Israel)
    CharacterCodePageWPC1256 = 33,                 ///< WPC1256
    CharacterCodePagePC437_StdEurope_50 = 50,      ///< PC437(Std.Europe)
    CharacterCodePageKatakana_51 = 51,             ///< Katakana
    CharacterCodePagePC437_StdEurope_52 = 52,      ///< PC437(Std.Europe)
    CharacterCodePagePC858_Multilingual = 53,      ///< PC858(Multilingual)
    CharacterCodePagePC861_Icelandic = 56,         ///< PC861(Icelandic)
    CharacterCodePagePC863_CanadianAlt = 57,       ///< PC863(Canadian)
    CharacterCodePagePC865_NordicAlt = 58,         ///< PC865(Nordic)
    CharacterCodePagePC866_Russian = 59,           ///< PC866(Russian)
    CharacterCodePagePC855_Bulgarian = 60,         ///< PC855(Bulgarian)
    CharacterCodePagePC857_Turkey = 61,            ///< PC857(Turkey)
    CharacterCodePagePC862_Hebrew = 62,            ///< PC862(Hebrew)
    CharacterCodePagePC864_Arabic = 63,            ///< PC864(Arabic)
    CharacterCodePagePC737_Greek = 64,             ///< PC737(Greek)
    CharacterCodePagePC851_Greek = 65,             ///< PC851(Greek)
    CharacterCodePagePC869_Greek = 66,             ///< PC869(Greek)
    CharacterCodePagePC928_Greek = 67,             ///< PC928(Greek)
    CharacterCodePagePC772_Lithuanian = 68,        ///< PC772(Lithuanian)
    CharacterCodePagePC774_Lithuanian = 69,        ///< PC774(Lithuanian)
    CharacterCodePagePC874_Thai = 70,              ///< PC874(Thai)
    CharacterCodePageWPC1252_Latin1 = 71,          ///< WPC1252(Latin-1)
    CharacterCodePageWPC1250_Latin2 = 72,          ///< WPC1250(Latin-2)
    CharacterCodePageWPC1251_Cyrillic = 73,        ///< WPC1251(Cyrillic)
    CharacterCodePagePC3840_IBMRussian = 74,       ///< PC3840(IBM-Russian)
    CharacterCodePagePC3841_Gost = 75,             ///< PC3841(Gost)
    CharacterCodePagePC3843_Polish = 76,           ///< PC3843(Polish)
    CharacterCodePagePC3844_CS2 = 77,              ///< PC3844(CS2)
    CharacterCodePagePC3845_Hungarian = 78,        ///< PC3845(Hungarian)
    CharacterCodePagePC3846_Turkish = 79,          ///< PC3846(Turkish)
    CharacterCodePagePC3847_BrazilABNT = 80,       ///< PC3847(Brazil-ABNT)
    CharacterCodePagePC3848_Brazil = 81,           ///< PC3848(Brazil)
    CharacterCodePagePC1001_ArabicAlt = 82,        ///< PC1001(Arabic)
    CharacterCodePagePC2001_Lithuanian = 83,       ///< PC2001(Lithuanian)
    CharacterCodePagePC3001_Estonian1 = 84,        ///< PC3001(Estonian-1)
    CharacterCodePagePC3002_Eston2 = 85,           ///< PC3002(Eston-2)
    CharacterCodePagePC3011_Latvian1 = 86,         ///< PC3011(Latvian-1)
    CharacterCodePagePC3012_Tatv2 = 87,            ///< PC3012(Tatv-2)
    CharacterCodePagePC3021_Bulgarian = 88,        ///< PC3021(Bulgarian)
    CharacterCodePageThai = 255                    ///< Thai
};

/// POS Text Width
typedef NS_ENUM(NSInteger, TextWidth) {
    TextWidth1 = 0, ///< Set Width Ratio to x1
    TextWidth2 = 16, ///< Set Width Ratio to x2
    TextWidth3 = 32, ///< Set Width Ratio to x3
    TextWidth4 = 48, ///< Set Width Ratio to x4
    TextWidth5 = 64, ///< Set Width Ratio to x5
    TextWidth6 = 80, ///< Set Width Ratio to x6
    TextWidth7 = 96, ///< Set Width Ratio to x7
    TextWidth8 = 112  ///< Set Width Ratio to x8
};

/// POS Text Height
typedef NS_ENUM(NSInteger, TextHeight) {
    TextHeight1 = 0, ///< Set Height Ratio to x1
    TextHeight2 = 1, ///< Set Height Ratio to x2
    TextHeight3 = 2, ///< Set Height Ratio to x3
    TextHeight4 = 3, ///< Set Height Ratio to x4
    TextHeight5 = 4, ///< Set Height Ratio to x5
    TextHeight6 = 5, ///< Set Height Ratio to x6
    TextHeight7 = 6, ///< Set Height Ratio to x7
    TextHeight8 = 7  ///< Set Height Ratio to x8
};

/// POS Barcode Type
typedef NS_ENUM(NSInteger, POSBarcodeType) {
    POSBarcodeTypeUPCA = 65, ///< UPC A
    POSBarcodeTypeUPCE = 66, ///< UPCE
    POSBarcodeTypeJAN13_EAN13 = 67, ///< JAN-13 | EAN-13
    POSBarcodeTypeJAN8_EAN8 = 68, ///< JAN-8
    POSBarcodeTypeCode39 = 69, ///< Code 39
    POSBarcodeTypeITF = 70, ///< ITF
    POSBarcodeTypeCodabar = 71, ///< Codabar
    POSBarcodeTypeCode93 = 72, ///< Code 93
    POSBarcodeTypeCode128 = 73 ///< Code 128
};

/// POS HRI Text Position
typedef NS_ENUM(NSInteger, HRITextPosition) {
    HRITextPositionNone,    ///< Do not print HRI text
    HRITextPositionAbove,   ///< Print HRI text above barcode
    HRITextPositionBelow,   ///< Print HRI text below barcode
    HRITextPositionBoth     ///< Print HRI text above and below barcode
};

/// POS QRCode Error Correction Level
typedef NS_ENUM(NSInteger, QRErrorCorrectionLevel) {
    QRErrorCorrectionLevelL = 48,    ///< Error Correction Level L (7%)
    QRErrorCorrectionLevelM = 49,    ///< Error Correction Level M (15%)
    QRErrorCorrectionLevelQ = 50,    ///< Error Correction Level Q (25%)
    QRErrorCorrectionLevelH = 51     ///< Error Correction Level H (30%)
};

/// POS QRCode Alignment
typedef NS_ENUM(NSInteger, QRCodeAlignment) {
    QRCodeAlignmentLeft = 0,       ///< Left Alignment
    QRCodeAlignmentCenter,         ///< Center Alignment
    QRCodeAlignmentRight           ///< Right Alignment
};

/// POS Paper Cut Type
typedef NS_ENUM(NSInteger, PaperCutType) {
    PaperCutTypeFull,      ///< Full Cut
    PaperCutTypePartial    ///< Partial Cut
};

/// POS Pin Number
typedef NS_ENUM(NSInteger, PinNumber) {
    PinNumberTwo = 2,      ///< Pin 2
    PinNumberFive = 5      ///< Pin 5
};

/// Real-time Printer Status
typedef NS_ENUM(NSInteger, PrinterAllStatusType) {
    PrinterStatusTypePrint = 1,     ///< Printing Status
    PrinterStatusTypeOffline = 2,    ///< Offline Status
    PrinterStatusTypeError = 3,      ///< Error Status
    PrinterStatusTypePaper = 4       ///< Paper Status
};

/// POS Printer State
typedef NS_ENUM(NSInteger, PrinterCommStatusType) {
    PrinterStatusTypeNormal = 0,                    ///< Printer Normal
    PrinterStatusTypeCoverOpen = -1,                ///< Cover Open
    PrinterStatusTypePaperEmpty = -2,               ///< Paper Empty
    PrinterStatusTypeOtherError = -3,               ///< Other Errors
    PrinterStatusTypeConnectionLost = -4,           ///< Connection Lost
    PrinterStatusTypeReceiveTimeout = -5,           ///< Receive Timeout
    PrinterStatusTypePressFeed = -6,                ///< Feed Button Pressed
    PrinterStatusTypePrinterError = -7              ///< Printer Error
};

/// POS print character set
typedef NS_ENUM(NSInteger, PrintCharacterSet) {
    PrintCharacterSetPC437StdEurope = 0,         ///< PC437(Std.Europe)
    PrintCharacterSetPC861Icelandic = 56,        ///< PC861(Icelandic)
    PrintCharacterSetKatakana = 1,               ///< Katakana
    PrintCharacterSetPC863Canadian = 57,         ///< PC863(Canadian)
    PrintCharacterSetPC850Multilingual = 2,      ///< PC850(Multilingual)
    PrintCharacterSetPC865Nordic = 59,           ///< PC865(Nordic)
    PrintCharacterSetPC860Portugal = 3,          ///< PC860(Portugal)
    PrintCharacterSetPC866Russian = 60,          ///< PC866(Russian)
    PrintCharacterSetPC865Nordic2 = 5,           ///< PC865(Nordic)
    PrintCharacterSetPC857Turkey = 61,           ///< PC857(Turkey)
    PrintCharacterSetWestEurope = 6,              ///< West Europe
    PrintCharacterSetPC862Hebrew = 62,            ///< PC862(Hebrew)
    PrintCharacterSetGreek = 7,                   ///< Greek
    PrintCharacterSetPC864Arabic = 63,            ///< PC864(Arabic)
    PrintCharacterSetHebrew = 8,                  ///< Hebrew
    PrintCharacterSetPC737Greek = 64,             ///< PC737(Greek)
    PrintCharacterSetEastEurope = 9,              ///< East Europe
    PrintCharacterSetPC851Greek = 65,             ///< PC851(Greek)
    PrintCharacterSetIran = 10,                   ///< Iran
    PrintCharacterSetPC869Greek = 66,             ///< PC869(Greek)
    PrintCharacterSetWPC1252 = 16,                ///< WPC1252
    PrintCharacterSetPC866Cyrillic2 = 67,         ///< PC866(Cyrillic#2)
    PrintCharacterSetPC852Latin2 = 18,            ///< PC852(Latin2)
    PrintCharacterSetPC858 = 19,                  ///< PC858
    PrintCharacterSetPC874Thai = 70,              ///< PC874(Thai)
    PrintCharacterSetWPC1252Latin1 = 71,          ///< WPC1252(Latin-1)
    PrintCharacterSetWPC1250Latin2 = 72,          ///< WPC1250(Latin-2)
    PrintCharacterSetWPC1251Cyrillic = 73,        ///< WPC1251(Cyrillic)
    PrintCharacterSetPC3840IBMRussian = 74,       ///< PC3840(IBM-Russian)
    PrintCharacterSetPC774Lithuanian = 69,        ///< PC774(Lithuanian)
    PrintCharacterSetPC1001Arabic = 82,           ///< PC1001(Arabic)
    PrintCharacterSetThai = 255,                  ///< Thai
    PrintCharacterSetPC2001Lithuan = 83,          ///< PC2001(Lithuanian)
    PrintCharacterSetWPC1251Estonian1 = 84,       ///< WPC1251(Estonian-1)
    PrintCharacterSetWPC1252Estonian2 = 85,       ///< WPC1252(Estonian-2)
    PrintCharacterSetPC3011Latvian1 = 86,         ///< PC3011(Latvian-1)
    PrintCharacterSetPC3012Tatv2 = 87,            ///< PC3012(Tatv-2)
    PrintCharacterSetPC3021Bulgarian = 88,        ///< PC3021(Bulgarian)
    PrintCharacterSetPC3041Maltese = 89           ///< PC3041(Maltese)
};

/// POS Dot Matrix Density
typedef NS_ENUM(NSInteger, DotMatrixDensity) {
    SingleDensity8 = 0,       ///< 8 Dot Single Density
    DoubleDensity8 = 1,       ///< 8 Dot Double Density
    SingleDensity24 = 2,      ///< 24 Dot Single Density (Not supported by 76 column printers)
    DoubleDensity24 = 3       ///< 24 Dot Double Density (Not supported by 76 column printers)
};

/// POS BMP Scale Type
typedef NS_ENUM(NSInteger, BmpScaleType) {
    BmpNormal = 0,                ///< Original Image Size
    BmpWidthDouble = 1,           ///< Double Width
    BmpHeightDouble = 2,          ///< Double Height
    BmpWidthHeightDouble = 3      ///< Double Width and Height
};

/// POS Direction Type
typedef NS_ENUM(NSInteger, DirectionType) {
    DirectionLeftTop = 0,         ///< From Top-Left to Right
    DirectionLeftBottom = 1,      ///< From Bottom-Left to Top
    DirectionRightBottom = 2,     ///< From Bottom-Right to Left
    DirectionRightTop = 3         ///< From Top-Right to Down
};

/// POS Font Type
typedef NS_ENUM(NSInteger, FontType) {
    FontStandard = 0,          ///< Standard ASCII Font (12 × 24)
    FontCompress = 1           ///< Compressed ASCII Font (9 × 17)
};

/// POS Alarm State
typedef NS_ENUM(NSInteger, AlarmState) {
    AlarmStateNone = 0,     ///< No buzzer sound, no alarm light flashing
    AlarmStateBuzzer = 1,   ///< Buzzer sound
    AlarmStateLight = 2,    ///< Alarm light flashing
    AlarmStateBoth = 3      ///< Buzzer sound and alarm light flashing
};


#pragma mark - TSPL ENUM

/// TSPL Direction
typedef NS_ENUM(NSInteger, DirectionTSPL) {
    TSPLForward, ///< Forward
    TSPLReverse ///< Reverse
};

/// TSPL Rotation
typedef NS_ENUM(NSInteger, TSPLRotation) {
    TSPLRotation0 = 0,      ///< No Rotation
    TSPLRotation90 = 90,    ///< Rotate 90 degrees clockwise
    TSPLRotation180 = 180,  ///< Rotate 180 degrees clockwise
    TSPLRotation270 = 270   ///< Rotate 270 degrees clockwise
};

/// TSPL Readable Type
typedef NS_ENUM(NSInteger, ReadableType) {
    ReadableTypeNone,   ///< Do not display readable characters
    ReadableTypeLeft,   ///< Display on the left
    ReadableTypeCenter, ///< Display in the center
    ReadableTypeRight   ///< Display on the right
};

/// TSPL BMP Processing Modes
typedef NS_ENUM(NSInteger, BMPMode) {
    BMPModeOverwrite,       ///< OVERWRITE
    BMPModeOR,              ///< OR
    BMPModeXOR,             ///< XOR
    BMPModeOverwriteZlib,   ///< OVERWRITE + zlib
    BMPModeORZlib,          ///< OR + zlib
    BMPModeXORZlib,         ///< XOR + zlib
};

/// TSPL Auto Response Mode
typedef NS_ENUM (NSUInteger,AutoResMode){
    ModeOFF     = 0, ///< Disable auto response
    ModeON      = 1, ///< Enable auto response after each print
    ModeBATCH   = 2, ///< Enable auto response after batch print
};


#pragma mark - ZPL ENUM

/// ZPL Rotation
typedef NS_ENUM(NSInteger, RotationZPL) {
    ZPLRotation0 = 0,      ///< No Rotation
    ZPLRotation90 = 90,    ///< Rotate 90 degrees clockwise
    ZPLRotation180 = 180,  ///< Rotate 180 degrees clockwise
    ZPLRotation270 = 270   ///< Rotate 270 degrees clockwise
};

/// ZPL Font Name: Base font size, character height x character width
typedef NS_ENUM(NSInteger, ZPLFontName) {
    ZPLFont9_5 = 0,   ///< 9 x 5
    ZPLFont11_7,      ///< 11 x 7
    ZPLFont18_10,     ///< 18 x 10
    ZPLFont42_20,     ///< 42 x 20
    ZPLFont26_13,     ///< 26 x 13
    ZPLFont60_40,     ///< 60 x 40
    ZPLFont34_22,     ///< 34 x 22
    ZPLFont24_24,     ///< 24 x 24
    ZPLFont20_18,     ///< 20 x 18
    ZPLFont28_24,     ///< 28 x 24
    ZPLFont35_31,     ///< 35 x 31
    ZPLFont40_35,     ///< 40 x 35
    ZPLFont48_42,     ///< 48 x 42
    ZPLFont59_53,     ///< 59 x 53
    ZPLFont80_71,     ///< 80 x 71
    ZPLFont15_12      ///< 15 x 12
};

/// CodeType for ZPL barcodes.
typedef NS_ENUM(NSInteger, ZPLBarCodeType) {
    ZPLBarCode11 = 0,       ///< Code 11
    ZPLBarCode25,           ///< Code 25
    ZPLBarCode39,           ///< Code 39
    ZPLBarCodeEAN8,         ///< EAN-8
    ZPLBarCodeUPCE,         ///< UPC-E
    ZPLBarCode93,           ///< Code 93
    ZPLBarCode128,          ///< Code 128
    ZPLBarCodeEAN13,        ///< EAN-13
    ZPLBarCodeCODA,         ///< CODA (not standard, perhaps intended as CODABAR)
    ZPLBarCodeMSI,          ///< MSI
    ZPLBarCodePLESSEY,      ///< PLESSEY
    ZPLBarCodeUPCEAN,       ///< UPC-EAN (combination of UPC-A and EAN-13)
    ZPLBarCodeUPCA          ///< UPC-A
};

/// HriText position for ZPL barcodes.
typedef NS_ENUM(NSInteger, HriTextZPL) {
    ZPLHriTextNone = 0,     ///< No human readable text
    ZPLHriTextBelow,        ///< Human readable text below the barcode
    ZPLHriTextAbove         ///< Human readable text above the barcode
};

/// CodePage for ZPL printing.
typedef NS_ENUM(NSInteger, CodePageZPL) {
    ZPLCodePageUSA1 = 0,            ///< USA 1 (Code Page 850)
    ZPLCodePageUSA2 = 1,            ///< USA 2 (Code Page 437)
    ZPLCodePageUK = 2,              ///< United Kingdom (Code Page 850)
    ZPLCodePageNL = 3,              ///< Netherlands (Code Page 850)
    ZPLCodePageDK = 4,              ///< Denmark (Code Page 850)
    ZPLCodePageSwede = 5,           ///< Sweden (Code Page 850)
    ZPLCodePageGER = 6,             ///< Germany (Code Page 850)
    ZPLCodePageFR1 = 7,             ///< France 1 (Code Page 850)
    ZPLCodePageFR2 = 8,             ///< France 2 (Code Page 850)
    ZPLCodePageITA = 9,             ///< Italy (Code Page 850)
    ZPLCodePageES = 10,             ///< Spain (Code Page 850)
    ZPLCodePageJA = 12,             ///< Japan (Code Page 932)
    ZPLCodePageUTF8 = 28,           ///< UTF-8
    ZPLCodePageUTF16Big = 29,       ///< UTF-16 Big Endian
    ZPLCodePageUTF16Little = 30     ///< UTF-16 Little Endian
};

/// ZPL Device Type for Storing Images
typedef NS_ENUM(NSInteger, ZPLDeviceType) {
    DeviceTypeR = 0,   ///< Default: R:
    DeviceTypeE,       ///< E:
    DeviceTypeB,       ///< B:
    DeviceTypeA        ///< A:
};

/// ZPL Diagonal Direction
typedef NS_ENUM(NSInteger, DiagonalDirection) {
    DiagonalDirectionRight = 0, ///< Right-leaning diagonal
    DiagonalDirectionLeft       ///< Left-leaning diagonal
};


#pragma mark - CPCL ENUM

/// CPCL Rotation
typedef NS_ENUM(NSInteger, RotationCPCL) {
    CPCLRotation0 = 0,       ///< No Rotation
    CPCLRotation90 = 90,     ///< Rotate 90 degrees clockwise
    CPCLRotation180 = 180,   ///< Rotate 180 degrees clockwise
    CPCLRotation270 = 270    ///< Rotate 270 degrees clockwise
};

/// CPCL Font
typedef NS_ENUM(NSInteger, FontCPCL) {
    CPCLFont0 = 0,     ///< Font 0
    CPCLFont1 = 1,     ///< Font 1
    CPCLFont2 = 2,     ///< Font 2
    CPCLFont3 = 3,     ///< Font 3
    CPCLFont4 = 4,     ///< Font 4
    CPCLFont5 = 5,     ///< Font 5
    CPCLFont6 = 6,     ///< Font 6
    CPCLFont7 = 7,     ///< Font 7
    CPCLFont24 = 24,   ///< Font 24
    CPCLFont55 = 55    ///< Font 55
};

/// CPCL BarCode Type
typedef NS_ENUM(NSInteger, CPCLBarCodeType) {
    CPCLBarCode128 = 0,    ///< Code 128
    CPCLBarCodeUPCA,       ///< UPC-A
    CPCLBarCodeUPCE,       ///< UPC-E
    CPCLBarCodeEAN13,      ///< EAN-13
    CPCLBarCodeEAN8,       ///< EAN-8
    CPCLBarCode39,         ///< Code 39
    CPCLBarCode93,         ///< Code 93
    CPCLBarCodeCODABAR     ///< CODABAR
};


/// CPCL BarCode Ratio
typedef NS_ENUM(NSInteger, BarCodeRatioCPCL) {
    CPCLBarCodeRatio0 = 0, ///< Wide:Narrow = 1.5 :1
    CPCLBarCodeRatio1 = 1, ///< Wide:Narrow = 2.0 :1
    CPCLBarCodeRatio2 = 2, ///< Wide:Narrow = 2.5 :1
    CPCLBarCodeRatio3 = 3, ///< Wide:Narrow = 3.0 :1
    CPCLBarCodeRatio4 = 4, ///< Wide:Narrow = 3.5 :1
    CPCLBarCodeRatio20 = 20, ///< Wide:Narrow = 2.0 :1
    CPCLBarCodeRatio21 = 21, ///< Wide:Narrow = 2.1 :1
    CPCLBarCodeRatio22 = 22, ///< Wide:Narrow = 2.2 :1
    CPCLBarCodeRatio23 = 23, ///< Wide:Narrow = 2.3 :1
    CPCLBarCodeRatio24 = 24, ///< Wide:Narrow = 2.4 :1
    CPCLBarCodeRatio25 = 25, ///< Wide:Narrow = 2.5 :1
    CPCLBarCodeRatio26 = 26, ///< Wide:Narrow = 2.6 :1
    CPCLBarCodeRatio27 = 27, ///< Wide:Narrow = 2.7 :1
    CPCLBarCodeRatio28 = 28, ///< Wide:Narrow = 2.8 :1
    CPCLBarCodeRatio29 = 29, ///< Wide:Narrow = 2.9 :1
    CPCLBarCodeRatio30 = 30 ///< Wide:Narrow = 3.0 :1
};

/// CPCL QR Code Mode
typedef NS_ENUM(NSInteger, QRCodeModesCPCL) {
    CPCLQRCodeModeORG = 1,     ///< Original Specification
    CPCLQRCodeModeEnhance = 2  ///< Enhanced Specification
};

/// CPCL Alignment
typedef NS_ENUM(NSInteger, AlignmentsCPCL) {
    CPCLAlignmentLeft = 0, ///< Left-align all subsequent fields
    CPCLAlignmentCenter, ///< Center-align all subsequent fields
    CPCLAlignmentRight  ///< Right-align all subsequent fields
};

#pragma mark - TSPL Constants

extern NSString * const kCountryUSA;                     ///< USA
extern NSString * const kCountryCanadianFrench;          ///< Canadian French
extern NSString * const kCountrySpanishLatinAmerica;     ///< Spanish Latin America
extern NSString * const kCountryDutch;                   ///< Dutch
extern NSString * const kCountryBelgian;                 ///< Belgian
extern NSString * const kCountryFranceFrench;            ///< France French
extern NSString * const kCountrySpainSpanish;            ///< Spain Spanish
extern NSString * const kCountryHungarian;               ///< Hungarian
extern NSString * const kCountryYugoslavian;             ///< Yugoslavian
extern NSString * const kCountryItalian;                 ///< Italian
extern NSString * const kCountrySwitzerland;             ///< Switzerland
extern NSString * const kCountrySlovak;                  ///< Slovak
extern NSString * const kCountryUnitedKingdom;           ///< United Kingdom
extern NSString * const kCountryDanish;                  ///< Danish
extern NSString * const kCountrySwedish;                 ///< Swedish
extern NSString * const kCountryNorwegian;               ///< Norwegian
extern NSString * const kCountryPolish;                  ///< Polish
extern NSString * const kCountryGerman;                  ///< German
extern NSString * const kCountryBrazil;                  ///< Brazil
extern NSString * const kCountryEnglishInternational;    ///< English International
extern NSString * const kCountryPortuguese;              ///< Portuguese
extern NSString * const kCountryFinnish;                 ///< Finnish

extern NSString * const kFNT_8_12;  ///< 8 x 12 Alphanumeric Font
extern NSString * const kFNT_12_20; ///< 12 x 20 Alphanumeric Font
extern NSString * const kFNT_16_24; ///< 16 x 24 Alphanumeric Font
extern NSString * const kFNT_24_32; ///< 24 x 32 Alphanumeric Font
extern NSString * const kFNT_32_48; ///< 32 x 48 Alphanumeric Font
extern NSString * const kFNT_14_19; ///< 14 x 19 OCR-B Alphanumeric Font
extern NSString * const kFNT_14_25; ///< 14 x 25 OCR-A Alphanumeric Font
extern NSString * const kFNT_21_27; ///< 21 x 27 OCR-B Alphanumeric Font
extern NSString * const kFNT_SIMPLIFIED_CHINESE; ///< Simplified Chinese 24x24 Font (GB Code)
extern NSString * const kFNT_TRADITIONAL_CHINESE; ///< Traditional Chinese 24x24 Font (Big Five Code)
extern NSString * const kFNT_KOREAN; ///< Korean 24x24 Font (KS Code)

extern NSString * const kQRCodeModeAuto;   /// Auto-generate QR Code
extern NSString * const kQRCodeModeManual; /// Manually generate QR Code

extern NSString * const kECLevelL; /// Error Correction Level L (7%)
extern NSString * const kECLevelM; /// Error Correction Level M (15%)
extern NSString * const kECLevelQ; /// Error Correction Level Q (25%)
extern NSString * const kECLevelH; /// Error Correction Level H (30%)

extern NSString * const kBarcodeTypeCode128;        /// Code 128, switching code subset automatically
extern NSString * const kBarcodeTypeCode128Manual;  /// Code 128, switching code subset manually
extern NSString * const kBarcodeTypeEAN128;         /// EAN128, switching code subset automatically
extern NSString * const kBarcodeTypeInterleaved25;  /// Interleaved 2 of 5
extern NSString * const kBarcodeTypeInterleaved25C; /// Interleaved 2 of 5 with check digit
extern NSString * const kBarcodeTypeCode39;        /// Code 39, switching standard and full ASCII mode automatically
extern NSString * const kBarcodeTypeCode39C;       /// Code 39 with check digit
extern NSString * const kBarcodeTypeCode93;        /// Code 93
extern NSString * const kBarcodeTypeEAN13;         /// EAN 13
extern NSString * const kBarcodeTypeEAN13_2;       /// EAN 13 with 2 digits add-on
extern NSString * const kBarcodeTypeEAN13_5;       /// EAN 13 with 5 digits add-on
extern NSString * const kBarcodeTypeEAN8;          /// EAN 8
extern NSString * const kBarcodeTypeEAN8_2;        /// EAN 8 with 2 digits add-on
extern NSString * const kBarcodeTypeEAN8_5;        /// EAN 8 with 5 digits add-on
extern NSString * const kBarcodeTypeCodabar;       /// Codabar
extern NSString * const kBarcodeTypePostnet;       /// Postnet
extern NSString * const kBarcodeTypeUPCA;          /// UPC-A
extern NSString * const kBarcodeTypeUPCA_2;        /// UPC-A with 2 digits add-on
extern NSString * const kBarcodeTypeUPCA_5;        /// UPC-A with 5 digits add-on
extern NSString * const kBarcodeTypeUPCE;          /// UPC-E
extern NSString * const kBarcodeTypeUPCE_2;        /// UPC-E with 2 digits add-on
extern NSString * const kBarcodeTypeUPCE_5;        /// UPC-E with 5 digits add-on
extern NSString * const kBarcodeTypeCpost;         /// China post
extern NSString * const kBarcodeTypeMSI;           /// MSI
extern NSString * const kBarcodeTypeMSIC;          /// MSI with check digit
extern NSString * const kBarcodeTypePlessey;       /// PLESSEY
extern NSString * const kBarcodeTypeITF14;         /// ITF14
extern NSString * const kBarcodeTypeEAN14;         /// EAN14
extern NSString * const kBarcodeTypeCode11;        /// Code 11
extern NSString * const kBarcodeTypeTelepen;       /// Telepen
extern NSString * const kBarcodeTypeTelepenN;      /// Telepen number
extern NSString * const kBarcodeTypePlanet;        /// Planet
extern NSString * const kBarcodeTypeCode49;        /// Code 49
extern NSString * const kBarcodeTypeDPIIdentcode;  /// Deutsche Post Identcode
extern NSString * const kBarcodeTypeDPILeitcode;   /// Deutsche Post Leitcode


#pragma mark - ZPL Constants

extern NSString * const kFNT_A; ///< Base font size 9x5
extern NSString * const kFNT_B; ///< Base font size 11x7
extern NSString * const kFNT_C; ///< Base font size 18x10
extern NSString * const kFNT_D; ///< Base font size 18x10
extern NSString * const kFNT_E; ///< Base font size 28x15
extern NSString * const kFNT_F; ///< Base font size 26x13
extern NSString * const kFNT_G; ///< Base font size 60x40
extern NSString * const kFNT_0; ///< Base font size 15x12
