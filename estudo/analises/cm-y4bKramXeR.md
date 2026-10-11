### Resumo

Quem apresenta é a Profa. Marla Murillo (com uma segunda participante, "Elice"), numa gravação de aula ao vivo com tela compartilhada (o relógio do Windows na gravação marca 05/05/2026). A aula é uma leitura comentada da Cartilha de documentos fiscais do CGIBS, capítulo "Novos campos e grupos de campos", item por item (1.1 a 1.10). A cada item a professora alterna a cartilha com a Nota Técnica 2025.002 v1.36 (leiaute e regras de validação), o Regulamento do IBS e a LC 214/2025 no site do Planalto. Mostra também a tabela oficial de CST e cClassTrib em Excel e testa combinações no validador do Portal de Conformidade Fácil. Há um exemplo numérico de doação escrito no Word durante a aula. No trecho final a aula muda para planilhas de parametrização tributária por regime (Lucro Real indústria, atacado e varejo; Simples Nacional), com ICMS, PIS/COFINS e IBS/CBS lado a lado, e para o cadastro de itens de um cliente. Não há slides: tudo é documento, planilha ou sistema na tela.

### Temas com minutagem (aproximada, ± 1 min)

Duração no player: cerca de 117 min.

| Início | Fim | Tema |
|---|---|---|
| 0 | ~4 | Abertura: capa e sumário da Cartilha do CGIBS (Pré-Comitê Gestor do IBS) |
| ~4 | ~8 | Visão geral da NT 2025.002: grupo UB, tipos de nota de débito e de crédito |
| ~8 | ~22 | Item 1.1 – Data da previsão de entrega (dPrevEntrega, dhSaiEnt, dhEmi) e evento de atualização da data |
| ~24 | ~34 | Item 1.2 – Compras governamentais (gCompraGov, tpOperGov, gTribCompraGov), com Regulamento, LC 214 e regras de validação |
| ~36 | ~37 | Item 1.3 – Notas de antecipação de pagamento (nota de débito tipo 06) |
| ~38 | ~43 | Item 1.4 – Indicador de bem móvel usado e crédito presumido (Regulamento, arts. 258 e 484) |
| ~44 | ~59 | Item 1.5 – Indicador de doação, com exemplo numérico no Word e cClassTrib 410003 e 410026 |
| ~60 | ~67 | Item 1.6 – Tributação regular (gTribRegular) e art. 445 da LC 214 (ZFM) |
| ~68 | ~75 | Indicadores da tabela cClassTrib, tela do emissor de nota avulsa da SEFAZ/RS e validador do Portal de Conformidade Fácil |
| ~76 | ~81 | Itens 1.7 e 1.8 – Transferência de crédito e ajuste de competência (CST 811) |
| ~82 | ~89 | Item 1.9 – Estorno de crédito, com tabela cClassTrib e arts. 49 a 53 da LC 214 |
| ~90 | ~91 | Item 1.10 – Crédito presumido da operação, no validador |
| ~92 | ~93 | Nota de crédito por redução de valores ou quantidades (texto no Word) |
| ~94 | ~105 | CST/cClassTrib e regimes diferenciados: tabela oficial, Regulamento (arts. 207 a 209) e Anexos VIII e IX da LC 214 |
| ~98 | ~117 | Planilhas de parametrização por regime e cadastro de itens de cliente (intercaladas com o tema anterior) |

### Exemplos, números, tabelas, telas e campos de nota

**Campos e grupos da NF-e (cartilha e NT)**

- ~4 a 6 min: NT 2025.002, grupo UB (informações de IBS, CBS e Imposto Seletivo): campos CSTIS, cClassTribIS, vBCIS, pIS. Campo finNFe e os tipos de nota de débito (01 transferência de crédito para cooperativas; 02 anulação de crédito por saídas imunes/isentas; 03 débitos de notas não processadas; 04 multa e juros; 05 transferência de crédito na sucessão; 06 pagamento antecipado; 07 perda em estoque).
- ~10 a 22 min: ordem de prioridade da data para apuração: dPrevEntrega, depois dhSaiEnt, depois dhEmi. Evento "Atualização da Data de Previsão de Entrega", modelo 55, código 112150 (item 8.19 da NT).
- ~24 min: grupo gCompraGov: tpEnteGov (1 União, 2 Estado, 3 DF, 4 Município), pRedutor, tpOperGov (1 fornecimento, 2 recebimento do pagamento).
- ~32 min: duas notas na compra governamental: uma no fornecimento (tpOperGov 1) e outra no pagamento (tpOperGov 2), ambas com gTribCompraGov.
- ~34 min: regra de validação B34-10, rejeição 1140 (nota de recebimento de pagamento de ente governamental sem nota de fornecimento referenciada); rejeições 1165 e 1166 (crédito presumido do IBS na ZFM).
- ~36 min: exemplo da cartilha: em janeiro/2026 o fornecedor recebe R$ 100,00 de antecipação e emite nota de débito tipo 06 (finNFe 6); grupo gPagAntecipado na nota de fornecimento.
- ~38 min: campo indBemMovelUsado (art. 171 da LC 214).
- ~42 min: Regulamento do IBS, art. 484, e percentuais 1,3% (2029), 2,6% (2030), 3,9% (2031), 5,2% (2032) e 13% (a partir de 2033).
- ~60 min: gTribRegular, com o exemplo de item com redução de 60% vendido a adquirente em Área de Livre Comércio com redução de 100% (art. 463).
- ~82 min: grupos gAjusteCompet, gEstornoCred e crédito presumido da operação (vCredPres).

**Exemplo numérico de doação (Word, ~46 a 52 min)**

- Opção a) tributar a valor de mercado: compra de R$ 1.000,00 sem impostos, alíquota de IBS/CBS de 28%, crédito de R$ 280,00 (total da nota R$ 1.280,00). Na doação, valor de mercado de R$ 1.300,00, 28% = R$ 364,00 (total R$ 1.664,00).
- Opção b) não incidência: cClassTrib 410003 (doação sem contraprestação, item que não gerou crédito) ou 410026 (doação com anulação de crédito, com estorno proporcional no grupo Estorno de Crédito).

**Tabela oficial CST/cClassTrib em Excel (~56, 68, 84, 88 e 94 min)**

- Abas com data de 15/04/2026. Colunas de indicadores: pRedIBS, pRedCBS, ind_gTribRegular, ind_gCredPresOper, ind_gMonoPadrao, ind_gEstornoCred, dIniVig.
- Linhas mostradas: CST 000 com 000001 a 000004 (regime automotivo, arts. 311 e 312); CST 200 (alíquota reduzida); CST 410 com 410026 (doação com anulação de crédito) e 410030 (estorno por perecimento, roubo, furto ou extravio, art. 47, § 6º); produtor rural não contribuinte; resíduos sólidos (art. 170).

**Telas de sistema**

- ~72 min: emissor de Nota Fiscal Avulsa da SEFAZ/RS (IntraSEFA/Procergs), tela "Produtos e Serviços", aba Tributos com a opção IBS/CBS ao lado de ICMS e ISSQN; ICMS 40 (isenta), código de benefício RS051003, lista de motivos de desoneração.
- ~74 min: Portal de Conformidade Fácil (validador): CST 410 com cClassTrib 410026; botões Tributação Padrão, Monofásica (CST 620), Transferência de Crédito (CST 800) e Ajuste de Competência (CST 811); aviso de que o CST 410 não permite informar tributação.
- ~80 min: no mesmo portal, CST 811 com cClassTrib 811001 (anulação de crédito por operações imunes e isentas, art. 51), 811002 (débitos de notas não processadas, art. 45) e 811003 (débitos após desenquadramento do Simples, art. 41); campos de ano-mês de referência, valor do IBS e valor da CBS.
- ~90 min: no portal, bloco de crédito presumido da operação (base, código cCredPres, percentual, valor e condição suspensiva, para IBS e para CBS).

**Legislação mostrada na tela**

- LC 214/2025: art. 7-A (~28 min), art. 12 (~30 min), art. 445 (~66 min), arts. 49 a 53 (~86 min), Anexo VIII – higiene pessoal e limpeza com redução de 60% e Anexo IX – insumos agropecuários (~100 min).
- Regulamento do IBS: art. 439 (~26 min), arts. 257 e 258 (~40 min), art. 484 (~42 min), arts. 207 a 209 (~96 min).

**Nota de crédito (Word, ~92 min)**

- finNFe 5 (nota de crédito), tpNFCredito 04 (redução de valores ou quantidades), CFOP inverso, natOp "Redução de valores ou quantidades", referência à nota original em refNFe.

**Planilhas de parametrização (~98 a 116 min)**

- Abas: Lucro Real Indústria, Lucro Real Comércio Atacadista, Lucro Real Comércio Varejista, Simples Nacional Indústria, Simples Nacional Comércio.
- Colunas: ICMS (CST, alíquota, FCP, base, cBenef), ICMS ST (MVA, CEST), PIS/COFINS, IPI e IBS/CBS (CST, cClassTrib, alíquotas, % de redução, % de diferimento).
- Exemplos: atacado com ICMS CST 000 a 17%, FCP 2%, PIS/COFINS CST 50 (1,65% e 7,60%) e IBS/CBS 000/000001 (0,10% e 0,90%); indústria com ICMS ST e MVA de 50%; Simples com "Pneu 175/65 R14", NCM 4011.10.00, CSOSN 500; varejo com linhas em CST 200 e cClassTrib de redução.
- ~112 a 114 min: planilha de cadastro de itens de um cliente (loja de artigos de pedra), com NCM, CSOSN 500 ou 102 e alíquotas, e uso da calculadora.

### Recomendação

Assistir só os trechos indicados, e com a cartilha do CGIBS aberta ao lado. A aula é longa e boa parte da tela é leitura de documentos oficiais que se pode ler direto, mais rápido. Os trechos que agregam algo além da leitura são: 44 a 59 min (doação, com o exemplo numérico e a escolha entre 410003 e 410026), 68 a 91 min (validador do Portal de Conformidade Fácil, ajuste de competência, estorno e crédito presumido) e 98 a 117 min (planilhas de parametrização por regime, ligadas ao cadastro de itens). O bloco de 8 a 43 min pode ser visto em velocidade acelerada ou substituído pela leitura dos itens 1.1 a 1.4 da cartilha, salvo se compras governamentais forem tema de algum cliente. Essa recomendação considera só o conteúdo visual; os comentários práticos da professora estão no áudio e podem mudar o peso de cada trecho.

### Como foi analisada

Só pelo que aparece na tela, sem o áudio: capturas de 2 em 2 minutos, do início ao fim. As minutagens são aproximadas (cerca de 1 minuto para mais ou para menos). Códigos e artigos foram lidos das capturas: confira na fonte oficial antes de usar.
