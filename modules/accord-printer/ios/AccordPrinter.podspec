Pod::Spec.new do |s|
  s.name = 'AccordPrinter'
  s.version = '1.0.0'
  s.summary = 'Accord Bluetooth printer bridge'
  s.description = 'Native Accord printer channels'
  s.author = 'Accord'
  s.homepage = 'https://www.xprinter.net/'
  s.platforms = { :ios => '16.4' }
  s.source = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,swift}'
  s.public_header_files = 'vendor/include/*.h'
  s.vendored_libraries = 'vendor/libPrinterSDK.a'
  s.frameworks = 'CoreBluetooth', 'CoreGraphics', 'UIKit'
end
