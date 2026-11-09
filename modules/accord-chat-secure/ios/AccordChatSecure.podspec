Pod::Spec.new do |s|
  s.name = 'AccordChatSecure'
  s.version = '0.1.0'
  s.summary = 'Cookie-free, non-redirecting Chat socket'
  s.description = 'Session-scoped Chat WebSocket transport for Accord.'
  s.author = ''
  s.homepage = 'https://docs.expo.dev/modules/'
  s.platforms = { :ios => '16.4' }
  s.source = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
