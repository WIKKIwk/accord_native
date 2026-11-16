Pod::Spec.new do |s|
  s.name = 'AccordAdminLayout'
  s.version = '0.1.0'
  s.summary = 'Real system window insets and source navigation mode for Admin layout'
  s.description = 'UI-thread window measurements for the Admin AppShell frame port.'
  s.author = ''
  s.homepage = 'https://docs.expo.dev/modules/'
  s.platforms = { :ios => '16.4' }
  s.source = { :git => '' }
  s.static_framework = true
  s.swift_version = '5.9'
  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
