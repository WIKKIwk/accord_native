Pod::Spec.new do |s|
  s.name = 'AccordProductionLive'
  s.version = '0.1.0'
  s.summary = 'Cookie-free, non-redirecting Production socket'
  s.description = 'Session-scoped production WebSocket transport for Accord.'
  s.author = ''
  s.homepage = 'https://docs.expo.dev/modules/'
  s.platforms = { :ios => '16.4' }
  s.source = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
