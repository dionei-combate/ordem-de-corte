using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Threading;
using System.Windows.Forms;

internal static class OrdemDeCorteLauncher
{
    private const string Url = "http://127.0.0.1:4180";

    [STAThread]
    private static void Main()
    {
        try
        {
            var appDirectory = AppDomain.CurrentDomain.BaseDirectory;
            var node = Path.Combine(appDirectory, "runtime", "node.exe");
            var server = Path.Combine(appDirectory, "server.cjs");
            var dataDirectory = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
                "Ordem de Corte",
                "dados");

            if (!File.Exists(node) || !File.Exists(server))
            {
                MessageBox.Show(
                    "Os componentes locais da Ordem de Corte não foram encontrados. Reinstale o aplicativo.",
                    "Ordem de Corte",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                return;
            }

            Directory.CreateDirectory(dataDirectory);

            if (!ServerIsReady())
            {
                var startInfo = new ProcessStartInfo
                {
                    FileName = node,
                    Arguments = "\"" + server + "\"",
                    WorkingDirectory = appDirectory,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    WindowStyle = ProcessWindowStyle.Hidden
                };
                startInfo.EnvironmentVariables["ORDEM_CORTE_DATA_DIR"] = dataDirectory;
                Process.Start(startInfo);

                for (var attempt = 0; attempt < 50 && !ServerIsReady(); attempt++)
                    Thread.Sleep(250);
            }

            if (!ServerIsReady())
            {
                MessageBox.Show(
                    "Não foi possível iniciar o serviço local. Reinicie o computador e tente novamente.",
                    "Ordem de Corte",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                return;
            }

            Process.Start(new ProcessStartInfo(Url) { UseShellExecute = true });
        }
        catch (Exception error)
        {
            MessageBox.Show(
                "Não foi possível abrir a Ordem de Corte.\n\n" + error.Message,
                "Ordem de Corte",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
        }
    }

    private static bool ServerIsReady()
    {
        try
        {
            var request = (HttpWebRequest)WebRequest.Create(Url + "/api/health");
            request.Method = "GET";
            request.Timeout = 800;
            request.ReadWriteTimeout = 800;
            using (var response = (HttpWebResponse)request.GetResponse())
                return response.StatusCode == HttpStatusCode.OK;
        }
        catch
        {
            return false;
        }
    }
}
