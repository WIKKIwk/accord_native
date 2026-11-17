package expo.modules.accordadminpresentation

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

internal class AdminSheetConfiguration : Record {
  @Field var presentationTicket: String = ""
  @Field var parentTicket: String = ""
  @Field var parentViewTag: Int = 0
  @Field var parentNativeID: String = ""
  @Field var heightPoints: Double = Double.NaN
  @Field var cornerRadius: Double = Double.NaN
  @Field var barrierOpacity: Double = Double.NaN
  fun snapshot(): AdminSheetConfigurationSnapshot? {
    if (!AdminSheetTransaction.validTicket(presentationTicket) || !AdminSheetTransaction.validTicket(parentTicket) || presentationTicket == parentTicket || parentViewTag <= 0 ||
      parentNativeID.isEmpty() || parentNativeID.length > 160 || !heightPoints.isFinite() || heightPoints <= 0 || !cornerRadius.isFinite() || cornerRadius < 0 || !barrierOpacity.isFinite() || barrierOpacity !in 0.0..1.0) return null
    return AdminSheetConfigurationSnapshot(presentationTicket, parentTicket, parentViewTag, parentNativeID, heightPoints, cornerRadius, barrierOpacity)
  }
}
internal data class AdminSheetConfigurationSnapshot(val presentationTicket: String, val parentTicket: String, val parentViewTag: Int, val parentNativeID: String,
  val heightPoints: Double, val cornerRadius: Double, val barrierOpacity: Double)
internal class AdminSheetAcceptedClose : Record {
  @Field var presentationTicket: String = ""
  @Field var closeTicket: String = ""
  @Field var transaction: String? = null
}
