package expo.modules.accordprinter

import java.io.ByteArrayOutputStream
import net.posprinter.TSPLPrinter
import org.junit.Assert.assertArrayEquals
import org.junit.Test

/** Byte fixtures were dumped with v2_oracle.sh from V2 baseline 7c87a54e. */
class BluetoothTsplParityTest {
    private class Capture : TSPLPrinter(null) {
        val output = ByteArrayOutputStream()
        override fun sendData(data: ByteArray): TSPLPrinter { output.write(data); return this }
        override fun sendData(data: MutableList<ByteArray?>): TSPLPrinter {
            data.filterNotNull().forEach { output.write(it) }; return this
        }
    }

    @Test fun labelsMatchV2Bytes() {
        val unsafeClass = Class.forName("sun.misc.Unsafe")
        val field = unsafeClass.getDeclaredField("theUnsafe").apply { isAccessible = true }
        val unsafe = field.get(null)
        val channelClass = Class.forName("expo.modules.accordprinter.BluetoothPrinterChannel")
        val labelClass = Class.forName("expo.modules.accordprinter.BluetoothLabelRequest")
        val channel = unsafeClass.getMethod("allocateInstance", Class::class.java).invoke(unsafe, channelClass)
        val companion = labelClass.getDeclaredField("Companion").apply { isAccessible = true }.get(null)
        val from = companion.javaClass.getDeclaredMethod("from", MethodCall::class.java).apply { isAccessible = true }
        val build = channelClass.getDeclaredMethod("buildSdkLabel", TSPLPrinter::class.java, labelClass).apply { isAccessible = true }
        val samples: Map<String, Map<String, Any?>> = linkedMapOf(
            "known" to mapOf("epc" to "00001", "item_code" to "00001", "item_name" to "PADDON 00001", "gross_qty" to 1.0, "label_kind" to "paddon_code", "print_count" to 2, "paddon_label_lines" to listOf("PADDON 00001", "MAHSULOT SONI: 7", "BRUTTO: 24.375 KG", "NETTO: 23.125 KG")),
            "unknown" to mapOf("epc" to "00001", "item_code" to "00001", "item_name" to "PADDON 00001", "gross_qty" to 1.0, "label_kind" to "paddon_code", "print_count" to 2, "paddon_label_lines" to listOf("PADDON 00001", "MAHSULOT SONI: 7", "BRUTTO: - KG", "NETTO: - KG")),
            "empty" to mapOf("epc" to "00001", "item_code" to "00001", "item_name" to "PADDON 00001", "gross_qty" to 1.0, "label_kind" to "paddon_code", "print_count" to 2, "paddon_label_lines" to listOf("PADDON 00001", "MAHSULOT SONI: 0", "BRUTTO: 0 KG", "NETTO: 0 KG")),
            "partial" to mapOf("epc" to "00001", "item_code" to "00001", "item_name" to "PADDON 00001", "gross_qty" to 1.0, "label_kind" to "paddon_code", "print_count" to 2, "paddon_label_lines" to listOf("PADDON 00001", "MAHSULOT SONI: 3", "BRUTTO: 12.123456 KG", "NETTO: - KG")),
            "legacy" to mapOf("epc" to "00001", "item_code" to "00001", "item_name" to "PADDON 00001", "gross_qty" to 1.0, "label_kind" to "paddon_code", "print_count" to 2, "paddon_label_lines" to listOf("PADDON 00001", "MAHSULOT SONI: -", "BRUTTO: - KG", "NETTO: - KG")),
            "pack" to mapOf("epc" to "00001", "item_code" to "P-1", "item_name" to "BOPP 120/12", "gross_qty" to 24.0, "tare_kg" to 2.0, "print_count" to 1),
            "material" to mapOf("epc" to "00001", "item_code" to "P-1", "item_name" to "BOPP 120/12", "gross_qty" to 24.0, "tare_kg" to 2.0, "print_count" to 1, "label_kind" to "material_product", "progress_qty" to 125.5, "progress_unit" to "m", "manufacturer_name" to "SUPPLIER", "material_name_lines" to listOf("HOMASHYO: BOPP 120/12"), "material_data_matrix" to true, "material_data_matrix_bars" to listOf(listOf(0, 0, 0.1, 0.1), listOf(0.2, 0, 0.3, 0.1), listOf(0.4, 0, 0.5, 0.1), listOf(0.6, 0, 0.7, 0.1), listOf(0.8, 0, 0.9, 0.1), listOf(0, 0.1, 0.2, 0.2), listOf(0.4, 0.1, 0.5, 0.2), listOf(0.6, 0.1, 0.7, 0.2), listOf(0.8, 0.1, 1, 0.2), listOf(0, 0.2, 0.1, 0.3), listOf(0.4, 0.2, 0.5, 0.3), listOf(0.6, 0.2, 0.8, 0.3), listOf(0, 0.3, 0.1, 0.4), listOf(0.2, 0.3, 0.3, 0.4), listOf(0.5, 0.3, 0.6, 0.4), listOf(0.7, 0.3, 0.8, 0.4), listOf(0.9, 0.3, 1, 0.4), listOf(0, 0.4, 0.1, 0.5), listOf(0.5, 0.4, 0.6, 0.5), listOf(0, 0.5, 0.1, 0.6), listOf(0.2, 0.5, 0.3, 0.6), listOf(0.4, 0.5, 0.6, 0.6), listOf(0.8, 0.5, 1, 0.6), listOf(0, 0.6, 0.1, 0.7), listOf(0.3, 0.6, 0.4, 0.7), listOf(0.5, 0.6, 0.7, 0.7), listOf(0, 0.7, 0.3, 0.8), listOf(0.7, 0.7, 0.8, 0.8), listOf(0.9, 0.7, 1, 0.8), listOf(0, 0.8, 0.5, 0.9), listOf(0.6, 0.8, 0.9, 0.9), listOf(0, 0.9, 1, 1))),
            "progress" to mapOf("epc" to "00001", "item_code" to "P-1", "item_name" to "BOPP 120/12", "gross_qty" to 24.0, "tare_kg" to 2.0, "print_count" to 1, "label_kind" to "progress", "progress_qty" to 125.5, "progress_unit" to "m", "material_data_matrix" to true, "material_data_matrix_bars" to listOf(listOf(0, 0, 0.1, 0.1), listOf(0.2, 0, 0.3, 0.1), listOf(0.4, 0, 0.5, 0.1), listOf(0.6, 0, 0.7, 0.1), listOf(0.8, 0, 0.9, 0.1), listOf(0, 0.1, 0.2, 0.2), listOf(0.4, 0.1, 0.5, 0.2), listOf(0.6, 0.1, 0.7, 0.2), listOf(0.8, 0.1, 1, 0.2), listOf(0, 0.2, 0.1, 0.3), listOf(0.4, 0.2, 0.5, 0.3), listOf(0.6, 0.2, 0.8, 0.3), listOf(0, 0.3, 0.1, 0.4), listOf(0.2, 0.3, 0.3, 0.4), listOf(0.5, 0.3, 0.6, 0.4), listOf(0.7, 0.3, 0.8, 0.4), listOf(0.9, 0.3, 1, 0.4), listOf(0, 0.4, 0.1, 0.5), listOf(0.5, 0.4, 0.6, 0.5), listOf(0, 0.5, 0.1, 0.6), listOf(0.2, 0.5, 0.3, 0.6), listOf(0.4, 0.5, 0.6, 0.6), listOf(0.8, 0.5, 1, 0.6), listOf(0, 0.6, 0.1, 0.7), listOf(0.3, 0.6, 0.4, 0.7), listOf(0.5, 0.6, 0.7, 0.7), listOf(0, 0.7, 0.3, 0.8), listOf(0.7, 0.7, 0.8, 0.8), listOf(0.9, 0.7, 1, 0.8), listOf(0, 0.8, 0.5, 0.9), listOf(0.6, 0.8, 0.9, 0.9), listOf(0, 0.9, 1, 1)), "progress_code_y" to 236, "progress_code_x" to 84, "progress_lines" to listOf(mapOf("text" to "APARAT: 7TALIK BOSMA", "y" to 12, "font" to "large", "char_width" to 16), mapOf("text" to "NETTO: 22.00 KG", "y" to 39, "font" to "large", "char_width" to 16))),
            "cell" to mapOf("epc" to "00001", "item_code" to "P-1", "item_name" to "BOPP 120/12", "gross_qty" to 24.0, "tare_kg" to 2.0, "print_count" to 1, "label_kind" to "qolip_cell", "material_data_matrix" to true, "material_data_matrix_bars" to listOf(listOf(0, 0, 0.1, 0.1), listOf(0.2, 0, 0.3, 0.1), listOf(0.4, 0, 0.5, 0.1), listOf(0.6, 0, 0.7, 0.1), listOf(0.8, 0, 0.9, 0.1), listOf(0, 0.1, 0.2, 0.2), listOf(0.4, 0.1, 0.5, 0.2), listOf(0.6, 0.1, 0.7, 0.2), listOf(0.8, 0.1, 1, 0.2), listOf(0, 0.2, 0.1, 0.3), listOf(0.4, 0.2, 0.5, 0.3), listOf(0.6, 0.2, 0.8, 0.3), listOf(0, 0.3, 0.1, 0.4), listOf(0.2, 0.3, 0.3, 0.4), listOf(0.5, 0.3, 0.6, 0.4), listOf(0.7, 0.3, 0.8, 0.4), listOf(0.9, 0.3, 1, 0.4), listOf(0, 0.4, 0.1, 0.5), listOf(0.5, 0.4, 0.6, 0.5), listOf(0, 0.5, 0.1, 0.6), listOf(0.2, 0.5, 0.3, 0.6), listOf(0.4, 0.5, 0.6, 0.6), listOf(0.8, 0.5, 1, 0.6), listOf(0, 0.6, 0.1, 0.7), listOf(0.3, 0.6, 0.4, 0.7), listOf(0.5, 0.6, 0.7, 0.7), listOf(0, 0.7, 0.3, 0.8), listOf(0.7, 0.7, 0.8, 0.8), listOf(0.9, 0.7, 1, 0.8), listOf(0, 0.8, 0.5, 0.9), listOf(0.6, 0.8, 0.9, 0.9), listOf(0, 0.9, 1, 1))),
            "qolip" to mapOf("epc" to "00001", "item_code" to "P-1", "item_name" to "BOPP 120/12", "gross_qty" to 24.0, "tare_kg" to 2.0, "print_count" to 1, "label_kind" to "qolip_code", "qolip_color" to "QIZIL", "customer_name" to "CUSTOMER", "material_data_matrix" to true, "material_data_matrix_bars" to listOf(listOf(0, 0, 0.1, 0.1), listOf(0.2, 0, 0.3, 0.1), listOf(0.4, 0, 0.5, 0.1), listOf(0.6, 0, 0.7, 0.1), listOf(0.8, 0, 0.9, 0.1), listOf(0, 0.1, 0.2, 0.2), listOf(0.4, 0.1, 0.5, 0.2), listOf(0.6, 0.1, 0.7, 0.2), listOf(0.8, 0.1, 1, 0.2), listOf(0, 0.2, 0.1, 0.3), listOf(0.4, 0.2, 0.5, 0.3), listOf(0.6, 0.2, 0.8, 0.3), listOf(0, 0.3, 0.1, 0.4), listOf(0.2, 0.3, 0.3, 0.4), listOf(0.5, 0.3, 0.6, 0.4), listOf(0.7, 0.3, 0.8, 0.4), listOf(0.9, 0.3, 1, 0.4), listOf(0, 0.4, 0.1, 0.5), listOf(0.5, 0.4, 0.6, 0.5), listOf(0, 0.5, 0.1, 0.6), listOf(0.2, 0.5, 0.3, 0.6), listOf(0.4, 0.5, 0.6, 0.6), listOf(0.8, 0.5, 1, 0.6), listOf(0, 0.6, 0.1, 0.7), listOf(0.3, 0.6, 0.4, 0.7), listOf(0.5, 0.6, 0.7, 0.7), listOf(0, 0.7, 0.3, 0.8), listOf(0.7, 0.7, 0.8, 0.8), listOf(0.9, 0.7, 1, 0.8), listOf(0, 0.8, 0.5, 0.9), listOf(0.6, 0.8, 0.9, 0.9), listOf(0, 0.9, 1, 1))),
            "paddon" to mapOf("epc" to "00001", "item_code" to "P-1", "item_name" to "BOPP 120/12", "gross_qty" to 24.0, "tare_kg" to 2.0, "print_count" to 1, "label_kind" to "paddon_code", "paddon_label_lines" to listOf("PADDON 00001", "MAHSULOT SONI: 7"), "material_data_matrix" to true, "material_data_matrix_bars" to listOf(listOf(0, 0, 0.1, 0.1), listOf(0.2, 0, 0.3, 0.1), listOf(0.4, 0, 0.5, 0.1), listOf(0.6, 0, 0.7, 0.1), listOf(0.8, 0, 0.9, 0.1), listOf(0, 0.1, 0.2, 0.2), listOf(0.4, 0.1, 0.5, 0.2), listOf(0.6, 0.1, 0.7, 0.2), listOf(0.8, 0.1, 1, 0.2), listOf(0, 0.2, 0.1, 0.3), listOf(0.4, 0.2, 0.5, 0.3), listOf(0.6, 0.2, 0.8, 0.3), listOf(0, 0.3, 0.1, 0.4), listOf(0.2, 0.3, 0.3, 0.4), listOf(0.5, 0.3, 0.6, 0.4), listOf(0.7, 0.3, 0.8, 0.4), listOf(0.9, 0.3, 1, 0.4), listOf(0, 0.4, 0.1, 0.5), listOf(0.5, 0.4, 0.6, 0.5), listOf(0, 0.5, 0.1, 0.6), listOf(0.2, 0.5, 0.3, 0.6), listOf(0.4, 0.5, 0.6, 0.6), listOf(0.8, 0.5, 1, 0.6), listOf(0, 0.6, 0.1, 0.7), listOf(0.3, 0.6, 0.4, 0.7), listOf(0.5, 0.6, 0.7, 0.7), listOf(0, 0.7, 0.3, 0.8), listOf(0.7, 0.7, 0.8, 0.8), listOf(0.9, 0.7, 1, 0.8), listOf(0, 0.8, 0.5, 0.9), listOf(0.6, 0.8, 0.9, 0.9), listOf(0, 0.9, 1, 1)))
        )
        for ((name, args) in samples) {
            val label = from.invoke(companion, MethodCall("printLabel", args))
            val capture = Capture()
            build.invoke(channel, capture, label)
            capture.print((args["print_count"] as Number).toInt())
            val expected = javaClass.getResourceAsStream("/tspl/$name.tspl")!!.readBytes()
            assertArrayEquals(name, expected, capture.output.toByteArray())
        }
    }
}
