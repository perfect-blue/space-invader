const std = @import("std");

const Builder = struct {
    b: *std.Build,
    opt: std.builtin.OptimizeMode,
    target: std.Build.ResolvedTarget,
    wasm_target: std.Build.ResolvedTarget,
    check_step: *std.Build.Step,
    wasm_step: *std.Build.Step,

    fn init(b: *std.Build) Builder {
        const check_step = b.step("check", "check");
        const wasm_step = b.step("wasm", "wasm");

        return .{
            .b = b,
            .opt = b.standardOptimizeOption(.{}),
            .target = b.standardTargetOptions(.{}),
            .wasm_target = b.resolveTargetQuery(.{
                .cpu_arch = .wasm32,
                .os_tag = .freestanding,
            }),
            .check_step = check_step,
            .wasm_step = wasm_step,
        };
    }

    fn installAndCheck(self: *Builder, elem: *std.Build.Step.Compile) *std.Build.Step.InstallArtifact {
        const duped = self.b.allocator.create(std.Build.Step.Compile) catch unreachable;
        duped.* = elem.*;
        self.b.installArtifact(elem);
        const install_artifact = self.b.addInstallArtifact(elem, .{});
        self.b.getInstallStep().dependOn(&install_artifact.step);
        self.check_step.dependOn(&duped.step);
        return install_artifact;
    }

    fn buildApp(self: *Builder) void {
        const wasm = self.b.addExecutable(.{
            .name = "index",
            .root_source_file = self.b.path("src/index.zig"),
            .target = self.wasm_target,
            .optimize = .ReleaseSmall,
        });
        wasm.entry = .disabled;
        wasm.rdynamic = true;
        const installed = self.installAndCheck(wasm);
        self.wasm_step.dependOn(&installed.step);
    }
};

pub fn build(b: *std.Build) void {
    var builder = Builder.init(b);
    builder.buildApp();
}
