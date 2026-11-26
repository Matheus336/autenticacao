"""Gera relatorio.pdf a partir de relatorio.md (Chrome headless + pypdf).

Uso: python gerar_pdf.py   (requer google-chrome e pypdf)
"""
import html
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

from pypdf import PdfReader, PdfWriter

AQUI = Path(__file__).resolve().parent
MD = AQUI / "relatorio.md"
SAIDA = AQUI / "relatorio.pdf"
CHROME = "google-chrome"

INTEGRANTES = [
    "Ana Clara Rodrigues Marques Santana",
    "Caio Almeida Carvalho Lima",
    "Cleiton Horalino Soares de Morais",
    "Felipe Rodrigo Ferreira",
    "Grazieli Maria Sarturi",
    "Matheus Felipe de Aguiar",
    "Murilo Pedron Dal Molim",
    "Pedro Luciano Moura Kuhn",
]
TITULO = "Sistema Acadêmico de Autenticação"
SUBTITULO = "Relatório técnico de auditoria de segurança: Implementação de Autenticação Segura e Gestão de Identidades"

CSS = """
@page { size: A4; margin: 3cm 2cm 2cm 3cm; }
* { box-sizing: border-box; }
body { font-family: 'Liberation Sans', Arial, sans-serif; font-size: 12pt; line-height: 1.5; color: #000; margin: 0; }
p { margin: 0 0 6pt 0; text-align: justify; text-indent: 1.25cm; }
p.sem-recuo, li p, td p { text-indent: 0; }
.pagina { page-break-after: always; break-after: page; }
.capa, .rosto { height: 24.6cm; display: flex; flex-direction: column; justify-content: space-between; text-align: center; }
.capa p, .rosto p { text-align: center; text-indent: 0; margin: 0; }
.caixa-alta { text-transform: uppercase; font-weight: bold; }
.maiusculas { text-transform: uppercase; }
.titulo-capa { font-size: 14pt; font-weight: bold; text-transform: uppercase; line-height: 1.4; }
.subtitulo-capa { font-size: 12pt; line-height: 1.4; margin-top: 8pt !important; }
.autores p { line-height: 1.5; }
.natureza { width: 8cm; margin-left: auto; text-align: justify !important; font-size: 10pt; line-height: 1.2; }
h1.pre { font-size: 12pt; text-align: center; text-transform: uppercase; margin: 0 0 18pt 0; }
h2 { font-size: 12pt; text-transform: uppercase; margin: 0 0 12pt 0; break-before: page; page-break-before: always; }
h3 { font-size: 12pt; margin: 18pt 0 6pt 0; break-after: avoid; }
h4 { font-size: 12pt; font-weight: bold; margin: 16pt 0 6pt 0; break-after: avoid; }
table { width: 100%; border-collapse: collapse; margin: 6pt 0 12pt 0; font-size: 10pt; line-height: 1.25; }
th, td { border: 0.6pt solid #000; padding: 3pt 5pt; vertical-align: top; text-align: left; }
th { background: #e6e6e6; font-weight: bold; }
tr { break-inside: avoid; page-break-inside: avoid; }
table.ficha { break-inside: avoid; page-break-inside: avoid; }
table.ficha td:first-child { width: 3.2cm; background: #f2f2f2; }
code { font-family: 'Liberation Mono', monospace; font-size: 9pt; overflow-wrap: anywhere; }
td code { font-size: 8.5pt; }
pre { font-family: 'Liberation Mono', monospace; font-size: 10pt; line-height: 1.3; border: 0.6pt solid #999; padding: 6pt 8pt; margin: 6pt 0 12pt 0; white-space: pre-wrap; }
ul, ol { margin: 0 0 8pt 0; padding-left: 1.25cm; }
li { text-align: justify; margin-bottom: 3pt; }
a { color: #000; text-decoration: none; }
.palavras { text-indent: 0; margin-top: 12pt; }
.ref p { text-indent: 0; text-align: left; line-height: 1.0; margin-bottom: 12pt; }
.sumario { width: 100%; }
.sumario div { display: flex; align-items: baseline; line-height: 1.5; }
.sumario .titulo { white-space: nowrap; }
.sumario .pontos { flex: 1; border-bottom: 1pt dotted #000; margin: 0 4pt; transform: translateY(-3pt); }
.sumario .n1 .titulo { font-weight: bold; text-transform: uppercase; }
.sumario .n2 { padding-left: 0.8cm; }
.sumario .sem-num .titulo { font-weight: bold; text-transform: uppercase; }
"""


def inline(t):
    t = html.escape(t, quote=False)
    t = re.sub(r"\[([^\]]+)\]\((http[^)]+)\)", r'<a href="\2">\1</a>', t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"`([^`]+)`", r"<code>\1</code>", t)
    return t


def slug(texto):
    return "s-" + re.sub(r"[^a-z0-9]+", "-", texto.lower()).strip("-")


def corpo_md():
    linhas = MD.read_text(encoding="utf-8").splitlines()
    inicio = next(i for i, l in enumerate(linhas) if l.startswith("## Controle de versões"))
    linhas = linhas[inicio:]
    blocos, atual = {}, None
    for l in linhas:
        m = re.match(r"## (.+)", l)
        if m:
            atual = m.group(1)
            blocos[atual] = []
            continue
        blocos[atual].append(l)
    return blocos


def render(linhas, ficha=False):
    out, i = [], 0
    while i < len(linhas):
        l = linhas[i]
        if l.startswith("```"):
            i += 1
            bloco = []
            while not linhas[i].startswith("```"):
                bloco.append(html.escape(linhas[i]))
                i += 1
            out.append("<pre>" + "\n".join(bloco) + "</pre>")
        elif m := re.match(r"(#{3,4}) (.+)", l):
            nivel = len(m.group(1))
            ficha = nivel == 4
            out.append(f'<h{nivel} id="{slug(m.group(2))}">{inline(m.group(2))}</h{nivel}>')
        elif l.startswith("|"):
            rows = []
            while i < len(linhas) and linhas[i].startswith("|"):
                cells = [c.strip() for c in linhas[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-+:?", c) for c in cells if c):
                    rows.append(cells)
                i += 1
            i -= 1
            classe = ' class="ficha"' if ficha and rows[0][0] == "Campo" else ""
            t = [f"<table{classe}>"]
            if classe:
                rows = rows[1:]
            else:
                t.append("<tr>" + "".join(f"<th>{inline(c)}</th>" for c in rows[0]) + "</tr>")
                rows = rows[1:]
            for r in rows:
                t.append("<tr>" + "".join(
                    f'<td style="white-space:nowrap">{inline(c)}</td>' if re.fullmatch(r"A-\d\d", c) else f"<td>{inline(c)}</td>"
                    for c in r) + "</tr>")
            t.append("</table>")
            out.append("".join(t))
        elif l.startswith("- "):
            itens = []
            while i < len(linhas) and linhas[i].startswith("- "):
                itens.append(f"<li>{inline(linhas[i][2:])}</li>")
                i += 1
            i -= 1
            out.append("<ul>" + "".join(itens) + "</ul>")
        elif re.match(r"\d+\. ", l):
            itens = []
            while i < len(linhas) and re.match(r"\d+\. ", linhas[i]):
                itens.append(f"<li>{inline(re.sub(r'^\d+\. ', '', linhas[i]))}</li>")
                i += 1
            i -= 1
            out.append("<ol>" + "".join(itens) + "</ol>")
        elif l.strip():
            out.append(f"<p>{inline(l)}</p>")
        i += 1
    return "\n".join(out)


def montar_html(paginas):
    blocos = corpo_md()
    capa = f"""
<div class="pagina capa">
  <div><p class="caixa-alta">Universidade Tecnológica Federal do Paraná</p>
  <p class="caixa-alta">Câmpus Dois Vizinhos</p></div>
  <div class="autores">{''.join(f'<p class="maiusculas">{n}</p>' for n in INTEGRANTES)}</div>
  <div><p class="titulo-capa">{TITULO}</p><p class="subtitulo-capa">{SUBTITULO}</p></div>
  <div><p class="caixa-alta">Dois Vizinhos</p><p class="caixa-alta">2026</p></div>
</div>"""
    rosto = f"""
<div class="pagina rosto">
  <div class="autores">{''.join(f'<p class="maiusculas">{n}</p>' for n in INTEGRANTES)}</div>
  <div><p class="titulo-capa">{TITULO}</p><p class="subtitulo-capa">{SUBTITULO}</p></div>
  <div><p class="natureza">Relatório técnico apresentado à disciplina Segurança e Auditoria em Sistemas (SA28S) da Universidade Tecnológica Federal do Paraná, Câmpus Dois Vizinhos, como entrega do Trabalho Prático 1, tema Implementação de Autenticação Segura e Gestão de Identidades.</p>
  <p class="natureza" style="margin-top:12pt">Professor: Erinaldo da Silva Pereira</p></div>
  <div><p class="caixa-alta">Dois Vizinhos</p><p class="caixa-alta">2026</p></div>
</div>"""

    resumo = blocos["Resumo"]
    resumo_html = render([l for l in resumo if not l.startswith("**Palavras-chave")])
    palavras = next(l for l in resumo if l.startswith("**Palavras-chave"))
    pre = f"""
<div class="pagina"><h1 class="pre">Resumo</h1>{resumo_html.replace('<p>', '<p class="sem-recuo">')}
<p class="palavras">{inline(palavras)}</p></div>
<div class="pagina"><h1 class="pre">Controle de versões</h1>{render(blocos["Controle de versões"])}</div>"""

    secoes = [k for k in blocos if k not in ("Controle de versões", "Resumo", "Sumário")]
    entradas = []
    corpo = []
    for s in secoes:
        sid = slug(s)
        numerada = bool(re.match(r"\d", s))
        entradas.append((1 if numerada else 0, s, sid))
        for l in blocos[s]:
            if m := re.match(r"### (.+)", l):
                entradas.append((2, m.group(1), slug(m.group(1))))
        conteudo = render(blocos[s])
        if s == "Referências":
            conteudo = f'<div class="ref">{conteudo}</div>'
        corpo.append(f'<h2 id="{sid}">{inline(s)}</h2>\n{conteudo}')

    linhas_sum = []
    for nivel, texto, sid in entradas:
        classe = {0: "sem-num", 1: "n1", 2: "n2"}[nivel]
        num = paginas[sid] - 1 if sid in paginas else ""
        linhas_sum.append(
            f'<div class="{classe}"><span class="titulo">{inline(texto)}</span>'
            f'<span class="pontos"></span><span class="num">{num}</span></div>'
        )
    sumario = f'<div class="pagina"><h1 class="pre">Sumário</h1><div class="sumario">{"".join(linhas_sum)}</div></div>'

    doc = f"""<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>{TITULO}: {SUBTITULO}</title><style>{CSS}</style></head><body>
{capa}{rosto}{pre}{sumario}
{''.join(corpo).replace('<h2 id="s-1-introdu', '<h2 style="break-before:auto;page-break-before:auto" id="s-1-introdu', 1)}
</body></html>"""
    return doc, entradas


def imprimir(html_txt, destino, tmp):
    fonte = Path(tmp) / "relatorio.html"
    fonte.write_text(html_txt, encoding="utf-8")
    subprocess.run(
        [CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
         f"--print-to-pdf={destino}", fonte.as_uri()],
        check=True, capture_output=True,
    )


def normalizar(t):
    return re.sub(r"\s+", " ", t).strip().lower()


def fim_sumario(pdf):
    textos = [normalizar(p.extract_text() or "") for p in PdfReader(pdf).pages]
    return next(n for n, t in enumerate(textos, start=1) if "apêndice c" in t)


def localizar(pdf, entradas, pagina_sumario):
    leitor = PdfReader(pdf)
    linhas = [[normalizar(l) for l in (p.extract_text() or "").splitlines()] for p in leitor.pages]
    paginas = {}
    for _, texto, sid in entradas:
        alvo = normalizar(re.sub(r"[`*]", "", texto))
        for n, ls in enumerate(linhas, start=1):
            if n <= pagina_sumario:
                continue
            if any(l == alvo or (len(l) > 20 and alvo.startswith(l)) for l in ls):
                paginas[sid] = n
                break
    return paginas, len(leitor.pages)


def numerar(pdf_base, primeira, total, tmp):
    folhas = "".join(
        f'<div style="height:29.6cm;position:relative;page-break-after:always">'
        f'{"" if n < primeira else f"<span style=position:absolute;top:2cm;right:2cm;font:10pt Liberation\\ Sans>{n - 1}</span>"}</div>'
        for n in range(1, total + 1)
    )
    overlay_html = f"<!doctype html><html><head><meta charset=utf-8><style>@page{{size:A4;margin:0}}body{{margin:0}}</style></head><body>{folhas}</body></html>"
    overlay = Path(tmp) / "numeros.pdf"
    imprimir(overlay_html, overlay, tmp)
    base = PdfReader(pdf_base)
    nums = PdfReader(overlay)
    w = PdfWriter()
    for i, pagina in enumerate(base.pages):
        if i < len(nums.pages):
            pagina.merge_page(nums.pages[i])
        w.add_page(pagina)
    w.add_metadata({"/Title": f"{TITULO}: {SUBTITULO}", "/Author": "; ".join(INTEGRANTES)})
    with open(SAIDA, "wb") as f:
        w.write(f)


def main():
    with tempfile.TemporaryDirectory() as tmp:
        rascunho = Path(tmp) / "rascunho.pdf"
        html_txt, entradas = montar_html({})
        imprimir(html_txt, rascunho, tmp)
        pagina_sumario = fim_sumario(rascunho)
        paginas, total = localizar(rascunho, entradas, pagina_sumario)
        for _ in range(2):
            html_txt, _ = montar_html(paginas)
            imprimir(html_txt, rascunho, tmp)
            novas, total = localizar(rascunho, entradas, pagina_sumario)
            if novas == paginas:
                break
            paginas = novas
        faltando = [t for _, t, s in entradas if s not in paginas]
        primeira = paginas[slug("1 Introdução")]
        numerar(rascunho, primeira, total, tmp)
        print(json.dumps({"paginas": total, "introducao": primeira, "sem_pagina": faltando}, ensure_ascii=False))


if __name__ == "__main__":
    sys.exit(main())
