import { isAuthorizedLegacyTimeout, isAuthorizedReadTimeout, isAuthorizedLegacyClientFailure, isAuthorizedReadClientFailure } from '../authorizedFetch';
import { MobileApiException } from '../shared/mobileApiException';
/** @v2 widgets/opened_order_edit_error_dialog.dart */
export function openedOrderEditErrorReason(error: unknown): string {
    if (isAuthorizedLegacyTimeout(error) || isAuthorizedReadTimeout(error))
        return 'Serverdan javob kutish muddati tugadi. So‘rov serverga yetib borgan bo‘lishi mumkin; buyurtmani qayta ochib, o‘zgarish saqlanganini tekshiring.';
    if (isAuthorizedLegacyClientFailure(error) || isAuthorizedReadClientFailure(error))
        return 'Server bilan aloqa o‘rnatilmadi yoki uzildi. Internet va server manzilini tekshiring. Qayta saqlashdan oldin buyurtmani ochib, oxirgi holatini tekshiring.';
    if (error instanceof SyntaxError || error instanceof TypeError)
        return 'Server javobi kutilgan ma’lumot formatida kelmadi. Buyurtmani qayta ochib holatini tekshiring; administrator server va ilova versiyalari mosligini tekshirishi kerak.';
    if (!(error instanceof MobileApiException))
        return 'Tahrirlash vaqtida kutilmagan xato yuz berdi. Buyurtmani qayta ochib holatini tekshiring. Muammo takrorlansa, mas’ul administratorga buyurtma raqamini yuboring.';
    if (error.statusCode === 401)
        return 'Kirish sessiyasi tugagan. Hisobingizga qayta kiring.';
    if (error.statusCode === 403)
        return 'Hisobingizda buyurtmani tahrirlash huquqi yo‘q. Mas’ul administratordan ruxsatlarni tekshirishni so‘rang.';
    if (error.code.startsWith('order_edit_') && error.message.trim() && !/[<>]/.test(error.message))
        return error.message;
    if ([502, 503, 504].includes(error.statusCode ?? 0))
        return 'Serverga olib boruvchi xizmat javob ololmadi yoki server hozir ishlamayapti. Administrator server va ulanish xizmatini tekshirishi kerak. Buyurtmani qayta ochib, saqlangan holatini tekshiring.';
    if ((error.statusCode ?? 0) >= 500)
        return 'Server buyurtma ma’lumotlarini tekshira yoki saqlay olmadi. Bu kiritgan ma’lumotlaringizdagi xato emas. Buyurtmani qayta ochib holatini tekshiring; muammo takrorlansa, mas’ul administratorga buyurtma raqamini yuboring.';
    const reason = error.message.replace(/^So‘ralgan amal bajarilmadi:\s*/, '').replace(/\s*\(HTTP \d+\)$/, '').trim();
    if (reason === 'Buyurtmaning asl Calculate ma’lumotlari saqlanmagan: tahrirlash mumkin emas')
        return 'Bu buyurtmaning dastlabki Calculate hisob-kitobi bazada saqlanmagan va unga mos yagona shablon aniqlanmadi. Bu hozir kiritgan ma’lumotlaringizdagi xato emas. Hisob-kitobni taxmin qilib o‘zgartirmaslik uchun tahrirlash bloklandi. Mas’ul administratorga buyurtma raqamini yuboring.';
    return !reason || reason === 'So‘ralgan amal bajarilmadi' ? 'Server tahrirlash so‘rovini bajarmadi, lekin sababini yubormadi. Mas’ul administratorga buyurtma raqamini yuboring.' : reason;
}
