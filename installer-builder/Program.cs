using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Security.Principal;
using System.Windows.Forms;

internal static class Program
{
    private const string InstallDirectoryName = "Ordem de Corte";

    [STAThread]
    private static int Main()
    {
        try
        {
            if (!IsAdministrator())
            {
                var current = Process.GetCurrentProcess().MainModule.FileName;
                var elevated = new ProcessStartInfo(current)
                {
                    UseShellExecute = true,
                    Verb = "runas",
                    WorkingDirectory = AppDomain.CurrentDomain.BaseDirectory
                };
                var child = Process.Start(elevated);
                if (child != null)
                {
                    child.WaitForExit();
                    return child.ExitCode;
                }
                return 1;
            }

            var temp = Path.Combine(Path.GetTempPath(), "OrdemDeCorteSetup-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(temp);
            try
            {
                StopPreviousInstallation();
                ExtractPayload(temp);
                var installer = Path.Combine(temp, "instalador", "Instalar-Ordem-de-Corte.ps1");
                var powershell = Path.Combine(Environment.SystemDirectory, "WindowsPowerShell", "v1.0", "powershell.exe");
                var install = Process.Start(new ProcessStartInfo(powershell)
                {
                    Arguments = string.Format("-NoProfile -ExecutionPolicy Bypass -File \"{0}\"", installer),
                    UseShellExecute = true,
                    WorkingDirectory = Path.GetDirectoryName(installer)
                });
                if (install != null)
                {
                    install.WaitForExit();
                    return install.ExitCode;
                }
                return 1;
            }
            finally
            {
                TryDelete(temp);
            }
        }
        catch (Exception error)
        {
            MessageBox.Show(
                "Não foi possível concluir a instalação da Ordem de Corte.\n\n" + error.Message,
                "Ordem de Corte",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            return 1;
        }
    }

    private static bool IsAdministrator()
    {
        using (var identity = WindowsIdentity.GetCurrent())
        {
            return new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator);
        }
    }

    private static void StopPreviousInstallation()
    {
        var installDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), InstallDirectoryName);
        foreach (var process in Process.GetProcessesByName("Ordem de Corte"))
        {
            try { process.Kill(); } catch { }
        }
        foreach (var process in Process.GetProcessesByName("node"))
        {
            try
            {
                if (process.MainModule.FileName.StartsWith(installDir, StringComparison.OrdinalIgnoreCase))
                    process.Kill();
            }
            catch { }
        }
    }

    private static void ExtractPayload(string destination)
    {
        using (var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("payload.zip"))
        {
            if (stream == null)
                throw new InvalidOperationException("O pacote interno não foi encontrado.");
            using (var archive = new ZipArchive(stream, ZipArchiveMode.Read))
            {
                foreach (var entry in archive.Entries)
                {
                    var target = Path.GetFullPath(Path.Combine(destination, entry.FullName));
                    var root = Path.GetFullPath(destination) + Path.DirectorySeparatorChar;
                    if (!target.StartsWith(root, StringComparison.OrdinalIgnoreCase))
                        throw new InvalidOperationException("O pacote contém um caminho inválido.");
                    if (String.IsNullOrEmpty(entry.Name))
                    {
                        Directory.CreateDirectory(target);
                        continue;
                    }
                    Directory.CreateDirectory(Path.GetDirectoryName(target));
                    using (var input = entry.Open())
                    using (var output = File.Create(target))
                        input.CopyTo(output);
                }
            }
        }
    }

    private static void TryDelete(string path)
    {
        try { Directory.Delete(path, true); } catch { }
    }
}
