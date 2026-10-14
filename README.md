# Ordem de Corte

Aplicativo local e separado do CortePRO para criar, gerenciar e imprimir ordens de corte.

## Baixar e instalar no Windows

**[Baixar o instalador Ordem de Corte](https://github.com/dionei-combate/ordem-de-corte/releases/latest/download/Ordem-de-Corte-Instalador.exe)**

1. Baixe `Ordem-de-Corte-Instalador.exe` pelo link acima.
2. Execute o arquivo e autorize a instalação quando o Windows pedir permissão.
3. Abra o aplicativo pelo atalho **Ordem de Corte** na Área de Trabalho ou no Menu Iniciar.

O instalador inclui o Node.js e as dependências. Não é necessário instalar ferramentas de desenvolvimento ou ter internet para instalar e usar o aplicativo após baixar o arquivo.

**Atenção: este instalador faz uma instalação zerada e remove os dados de uma instalação anterior. Faça uma cópia dos seus dados antes de reinstalar.** Os dados ficam em `C:\ProgramData\Ordem de Corte\dados`.

Consulte as [versões disponíveis](https://github.com/dionei-combate/ordem-de-corte/releases) para ver o instalador e seu arquivo de verificação SHA-256. Em repositórios privados, é necessário entrar em uma conta GitHub com acesso ao projeto.

## Baixar o código-fonte

Na página do repositório, clique em **Code → Download ZIP**, ou execute:

```powershell
git clone https://github.com/dionei-combate/ordem-de-corte.git
```

## Executar pelo código-fonte

Requer Node.js 22.5 ou superior.

```powershell
npm ci
npm start
```

Abra `http://127.0.0.1:4180`.

O banco SQLite é criado automaticamente em `dados/ordem-de-corte.sqlite`.
