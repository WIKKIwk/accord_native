import ExpoModulesCore

public class AccordNativeClockModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AccordNativeClock")
    Function("microsecondsSinceEpoch") { () throws -> String in try EpochMicroseconds.now() }
  }
}
