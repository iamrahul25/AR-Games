package com.margelo.nitro.arpose

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip

@DoNotStrip
@Keep
class HybridPoseDetectorFactory : HybridPoseDetectorFactorySpec() {
  @DoNotStrip
  @Keep
  override fun createPoseDetector(options: PoseDetectorOptions): HybridPoseDetectorSpec {
    return HybridPoseDetector(options)
  }
}
