# PXG — Divisor de loot

HTML, CSS e JavaScript sem dependências. Abra index.html no navegador ou use Live Server no VS Code. Não precisa instalar Node para usar; Node é necessário apenas para executar `node test.cjs`.

## Como usar
1. Importe UM arquivo JSON ou TSV exportado pelo jogo. Os arquivos .txt anexados também funcionam. A importação substitui a anterior: não importe os dois como se fossem a mesma sessão.
2. Confira jogadores, suprimentos e preços. Adicione participantes que não aparecem no arquivo e gastos extras, quando necessário.
3. Revise os itens ignorados e preços zero em “Editar loot e suprimentos”. Os mesmos itens podem ter preços diferentes em linhas distintas.
4. Escolha dinheiro, itens ou ambos. Dinheiro adicional não pode duplicar um valor já contabilizado no loot.
5. Calcule e baixe o relatório TXT.

## Regra
Gastos = suprimentos não ignorados + gastos extras.
Lucro = valor a dividir − gastos do grupo.
Direito de cada jogador = gasto individual + lucro dividido igualmente.

- Dinheiro: considera a venda de todo o loot incluído, mais dinheiro adicional.
- Itens: distribui somente os itens incluídos pelo valor deles, priorizando quem tem maior valor restante a receber. Não considera dinheiro adicional.
- Ambos: distribui os itens e considera também dinheiro adicional.

Reúna os itens e o dinheiro em um caixa do grupo antes de executar a distribuição. A ferramenta não gera rotas de transferência a partir dos jogadores que coletaram cada item.

Itens não são fracionados. A sugestão não garante a melhor combinação possível. O ajuste financeiro positivo indica receber dinheiro; negativo indica pagar. Mesmo no modo apenas itens, itens indivisíveis podem exigir compensação em dinheiro para fechar a divisão exata. Itens de preço zero são distribuídos por quantidade, sem afetar o reembolso.

Se houver prejuízo, ele é dividido igualmente. Nesse caso o reembolso completo é impossível com o loot disponível; o relatório mostra contribuições necessárias quando houver direitos negativos. Arredondamento em centésimos, com diferenças de 0,01 na ordem dos jogadores.

A calculadora usa quantidade × preço unitário das linhas, em vez do resumo da sessão, que pode estar arredondado. No JSON de exemplo: loot 832.325,50; gastos 131.392,00; lucro 700.933,50. D Eternal Flame tem direito a 416.800,75 e Gansta Love a 415.524,75.

## Publicar no GitHub Pages
1. Crie um repositório no GitHub.
2. Envie os arquivos desta pasta para a raiz do repositório. index.html deve estar na raiz.
3. Abra Settings → Pages.
4. Em Source, escolha Deploy from a branch.
5. Selecione main e /(root), depois Save.
6. Aguarde a publicação; o endereço aparecerá em Pages.

Documentação oficial: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

Os exemplos contêm nomes de jogadores. Você pode excluir a pasta exemplos e test.cjs antes de publicar. Não há backend nem envio de arquivos; os dados ficam em memória até recarregar a página.
