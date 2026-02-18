# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-18

### Added
- Centralização do versionamento do projeto
- Arquivo VERSION como fonte única de verdade para a versão
- CHANGELOG.md para rastreamento de mudanças
- Script de atualização automática de versão
- Integração de versão entre frontend, backend e Python engine

### Changed
- Unificação de versões inconsistentes (package.json: 1.0.0, constants.py: 1.5, useFileOperations.ts: 3.0.0)
- Versão padronizada para 1.0.0 como baseline para versionamento semântico

### Fixed
- Inconsistências de versionamento em múltiplos arquivos do projeto
