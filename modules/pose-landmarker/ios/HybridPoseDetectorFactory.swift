//
//  HybridPoseDetectorFactory.swift
//  ARPoseLandmarker
//

import NitroModules

class HybridPoseDetectorFactory: HybridPoseDetectorFactorySpec {
  func createPoseDetector(options: PoseDetectorOptions) throws -> any HybridPoseDetectorSpec {
    return HybridPoseDetector(options: options)
  }
}
