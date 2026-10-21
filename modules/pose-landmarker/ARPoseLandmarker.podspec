require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "ARPoseLandmarker"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => 15.5 }
  s.source       = { :git => "https://github.com/ar-games/ar-games.git", :tag => "#{s.version}" }

  s.source_files = [
    "ios/**/*.{swift}",
    "ios/**/*.{m,mm}",
  ]
  s.resource_bundles = {
    "ARPoseLandmarkerModels" => ["models/*.task"]
  }
  s.frameworks = ["AVFoundation", "CoreImage"]

  load "nitrogen/generated/ios/ARPoseLandmarker+autolinking.rb"
  add_nitrogen_files(s)

  s.dependency "MediaPipeTasksVision", "~> 1.0"
  s.dependency "VisionCamera"
  s.dependency "React-jsi"
  s.dependency "React-callinvoker"
  install_modules_dependencies(s)
end
