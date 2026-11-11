Pod::Spec.new do |s|
  s.name = 'AccordListScroll'
  s.version = '0.1.0'
  s.summary = 'Programmatic scrolling for the existing Expo SwiftUI List'
  s.description = 'ScrollViewReader wrapper preserving native List rows and swipe actions.'
  s.author = ''
  s.homepage = 'https://docs.expo.dev/versions/v58.0.0/sdk/ui/swift-ui/extending/'
  s.platforms = { :ios => '16.4' }
  s.source = { :git => '' }
  s.static_framework = true
  s.swift_version = '5.9'
  s.dependency 'ExpoModulesCore'
  s.dependency 'ExpoUI'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
