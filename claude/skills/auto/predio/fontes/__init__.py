"""Fontes plugáveis locais: falhas isoladas e prazo de 10 s por fonte."""

import json
from pathlib import Path
import subprocess
import sys


def coletar(pasta):
    resultado = {}
    for arquivo in sorted(Path(__file__).parent.glob('*.py')):
        nome = arquivo.stem
        if nome.startswith('_') or not nome.isidentifier():
            continue
        try:
            processo = subprocess.run(
                [sys.executable, '-c',
                 'import importlib,json,sys; '
                 'm=importlib.import_module("fontes."+sys.argv[1]); '
                 'print(json.dumps(m.coletar(sys.argv[2]),ensure_ascii=True))',
                 nome, str(pasta)], cwd=Path(__file__).resolve().parent.parent,
                capture_output=True, timeout=10, check=True)
            dados = json.loads(processo.stdout)
            if isinstance(dados, dict):
                resultado['central' if nome == 'central_canais' else nome] = dados
        except (OSError, ValueError, subprocess.SubprocessError):
            continue
    return resultado
