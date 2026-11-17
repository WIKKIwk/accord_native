package expo.modules.accordadminpresentation;

public final class AdminSheetWindowEvidenceHostTest {
  private static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
  public static void main(String[] args) {
    String name = args[0]; Object activityLayoutToken = new Object();
    switch (name) {
      case "normal-dialogs-have-distinct-view-application-tokens":
        Object activityIWindow = new Object(), rnModalIWindow = new Object(), ownedDialogIWindow = new Object();
        // AOSP View.applicationWindowToken for each normal top-level window equals its own IWindow,
        // not the Activity token in actual Decor.layoutParams. The old cross-window check fails.
        Object activityViewApplicationToken = activityIWindow, parentViewApplicationToken = rnModalIWindow, ownViewApplicationToken = ownedDialogIWindow;
        check(activityViewApplicationToken != parentViewApplicationToken && parentViewApplicationToken != ownViewApplicationToken, "fixture collapsed real windows");
        check(activityIWindow != activityLayoutToken && rnModalIWindow != activityLayoutToken && ownedDialogIWindow != activityLayoutToken, "IWindow is not Activity token");
        check(AdminSheetWindowEvidence.sameApplicationCohort(activityLayoutToken, 1, 0, activityLayoutToken, 2, 0), "real RNModal parent rejected");
        check(AdminSheetWindowEvidence.ownedNormalDialog(activityLayoutToken, 1, 0, activityLayoutToken, 2, 0), "real owned dialog rejected"); break;
      case "foreign-activity-cohort-rejected":
        check(!AdminSheetWindowEvidence.sameApplicationCohort(activityLayoutToken, 1, 0, new Object(), 2, 0), "foreign Activity adopted");
        check(!AdminSheetWindowEvidence.ownedNormalDialog(activityLayoutToken, 1, 0, new Object(), 2, 0), "foreign owned window adopted"); break;
      case "unknown-actual-layout-token-rejected":
        check(!AdminSheetWindowEvidence.sameApplicationCohort(null, 1, 0, null, 2, 0), "null/null invented association");
        check(!AdminSheetWindowEvidence.sameApplicationCohort(activityLayoutToken, 1, 0, null, 2, 0), "unknown dialog token adopted"); break;
      case "subwindow-is-not-normal-application-cohort":
        for (int type : new int[] {1000, 1001, 1003, 1999}) {
          check(!AdminSheetWindowEvidence.sameApplicationCohort(activityLayoutToken, 1, 0, activityLayoutToken, type, 0), "subwindow token confused with Activity token");
          check(!AdminSheetWindowEvidence.ownedNormalDialog(activityLayoutToken, 1, 0, activityLayoutToken, type, 0), "subwindow pretended normal Dialog");
        } break;
      case "system-and-invalid-window-types-rejected":
        for (int type : new int[] {-1, 0, 100, 2000, 2038}) {
          check(!AdminSheetWindowEvidence.sameApplicationCohort(activityLayoutToken, type, 0, activityLayoutToken, 2, 0), "foreign Activity type");
          check(!AdminSheetWindowEvidence.sameApplicationCohort(activityLayoutToken, 1, 0, activityLayoutToken, type, 0), "foreign parent type");
        } break;
      case "owned-dialog-cannot-be-base-activity-window":
        check(AdminSheetWindowEvidence.sameApplicationCohort(activityLayoutToken, 1, 0, activityLayoutToken, 1, 0), "valid parent Activity association");
        check(!AdminSheetWindowEvidence.ownedNormalDialog(activityLayoutToken, 1, 0, activityLayoutToken, 1, 0), "Activity pretended owned dialog"); break;
      case "actual-display-mismatch-rejected":
        check(!AdminSheetWindowEvidence.sameApplicationCohort(activityLayoutToken, 1, 0, activityLayoutToken, 2, 1), "cross-display native window adopted");
        check(!AdminSheetWindowEvidence.ownedNormalDialog(activityLayoutToken, 1, 2, activityLayoutToken, 2, 0), "owned window crossed original display"); break;
      case "unknown-display-never-defaults-to-zero":
        check(!AdminSheetWindowEvidence.sameApplicationCohort(activityLayoutToken, 1, -1, activityLayoutToken, 2, -1), "unknown/unknown became display0");
        check(!AdminSheetWindowEvidence.sameApplicationCohort(activityLayoutToken, 1, 0, activityLayoutToken, 2, -1), "unknown parent display adopted"); break;
      case "same-actual-secondary-display-metadata-is-not-faked-primary":
        check(AdminSheetWindowEvidence.sameApplicationCohort(activityLayoutToken, 1, 3, activityLayoutToken, 2, 3), "actual same display rejected");
        check(AdminSheetWindowEvidence.ownedNormalDialog(activityLayoutToken, 1, 3, activityLayoutToken, 2, 3), "actual same owned display rejected"); break;
      default: throw new AssertionError(name);
    }
    System.out.println(name + " passed");
  }
}
