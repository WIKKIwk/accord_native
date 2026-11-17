Pod::Spec.new do |s|
  s.name = 'AccordAdminPresentation'
  s.version = '0.1.0'
  s.summary = 'Original owned UIKit sheet presentation facts for Admin'
  s.description = 'An unconnected original-parent portal with actual UIKit presentation and dismissal receipts.'
  s.author = ''
  s.homepage = 'https://docs.expo.dev/modules/'
  s.platforms = { :ios => '16.4' }
  s.source = { :git => '' }
  s.static_framework = true
  s.swift_version = '5.9'
  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,mm,swift}'
end
