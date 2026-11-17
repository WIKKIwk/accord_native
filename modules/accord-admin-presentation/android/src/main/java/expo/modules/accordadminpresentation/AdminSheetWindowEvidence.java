package expo.modules.accordadminpresentation;

/** Pure policy for ACTUAL attached Decor.layoutParams facts. This does not establish attachment,
 * readiness, or per-window identity. View.applicationWindowToken is not an Activity cohort token. */
public final class AdminSheetWindowEvidence {
  private AdminSheetWindowEvidence() {}
  private static boolean applicationType(int type) { return type >= 1 && type <= 99; }
  public static boolean sameApplicationCohort(Object activityLayoutToken, int activityType, int activityDisplay,
      Object otherLayoutToken, int otherType, int otherDisplay) {
    return activityLayoutToken != null && activityLayoutToken == otherLayoutToken &&
      applicationType(activityType) && applicationType(otherType) && activityDisplay >= 0 && activityDisplay == otherDisplay;
  }
  public static boolean ownedNormalDialog(Object activityLayoutToken, int activityType, int activityDisplay,
      Object ownedLayoutToken, int ownedType, int ownedDisplay) {
    return ownedType == 2 && sameApplicationCohort(activityLayoutToken, activityType, activityDisplay, ownedLayoutToken, ownedType, ownedDisplay);
  }
}
