# Ponto — os dois modos

O módulo de RH tem dois modos de registro de ponto, escolhidos por empresa em
**RH / Pessoas → Ponto → Configurar modo**. Eles coexistem: uma empresa pode
usar um e outra o outro.

## Modo gestão (padrão)

Lançamento editável pelo RH, com marcação por localização opcional.

- `rh_ponto` — resumo do dia (entrada, almoço, saída), ajustável
- `rh_ponto_marcacoes` — o que foi batido na hora, com coordenada

Serve para acompanhamento interno, home office e prestadores. **Não tem valor
de registro eletrônico de ponto** e não deve ser apresentado como tal.

## Modo eletrônico (Portaria 671 / REP-P)

Registro imutável, com NSR sequencial e cadeia de hash.

- `rh_ponto_registros` — imutável
- `registrar_ponto_eletronico()` — única forma de gravar
- `verificar_cadeia_ponto()` — confere a integridade da cadeia

### O que está implementado

| Requisito | Situação |
|---|---|
| Registro não alterável nem excluível | Gatilho no banco bloqueia `UPDATE` e `DELETE` |
| NSR sequencial por empregador | Calculado no banco, com lock por empresa |
| Integridade verificável | Cadeia SHA-256: cada registro inclui o hash do anterior |
| Comprovante ao trabalhador a cada marcação | Exibido na hora e disponível para download depois |
| Identificação de empregador e trabalhador | CNPJ, CEI, razão social e CPF |
| Marcação sem restrição ou bloqueio | Sem aprovação prévia; localização negada não impede |
| Localização da marcação | Latitude, longitude e precisão |

O NSR e o hash são calculados **no banco**, em função `SECURITY DEFINER`. O
`INSERT` direto está bloqueado por RLS — se o navegador pudesse gravar, poderia
forjar a cadeia, que é justamente o que denuncia adulteração.

### O que falta para valer como registro legal

Estes pontos são **bloqueantes** para uso como REP-P homologado:

1. **Assinatura digital qualificada ICP-Brasil.** A norma exige PAdES no
   comprovante e CAdES (`.p7s` destacado) no AFD e no AEJ. Depende de
   certificado da empresa e de um serviço de assinatura — não dá para fazer no
   navegador.
2. **Validação do leiaute do AFD.** O exportador segue a ordem de campos
   documentada (NSR, tipo, data/hora da marcação, CPF, data/hora da gravação,
   indicador online/offline, hash SHA-256), mas as posições e tamanhos exatos
   não foram conferidos contra o arquivo oficial do MTE — o download do leiaute
   estava inacessível no momento da implementação. Por isso o arquivo sai
   nomeado `AFD-conferir-leiaute-*.txt`.
3. **AEJ** (Arquivo Eletrônico de Jornada) não foi implementado.
4. **Espelho de ponto** do trabalhador não foi implementado.

Enquanto esses itens não forem resolvidos, o modo eletrônico entrega
imutabilidade, rastreabilidade e comprovante — **mas não substitui um REP
homologado** para empresas sob CLT. A tela de configuração diz isso ao usuário,
para a decisão não depender de alguém ter lido este documento.

### Nota sobre a imutabilidade

O gatilho impede alteração pela aplicação e por qualquer conexão comum. Quem
tem privilégio de dono do banco pode desabilitar o gatilho — é assim no
Postgres. É por isso que a cadeia de hash existe: mesmo desabilitando o
gatilho, alterar uma linha quebra o elo, e `verificar_cadeia_ponto()` aponta o
NSR onde a cadeia foi rompida.

## Marcação manual e automática

Os dois modos aceitam as duas formas — não é escolha entre uma ou outra.

**Automática:** o colaborador aperta um botão e o sistema captura data, hora e
localização do próprio dispositivo. Não há o que digitar nem escolher: a
próxima batida é sempre o primeiro horário vazio da sequência.

**Manual:** para esquecimento, falha do aparelho ou trabalho externo.

- No modo gestão, o RH lança e edita direto.
- No modo eletrônico, o lançamento manual **não altera nem apaga** nada: entra
  como registro novo, marcado como `manual`, com justificativa obrigatória e o
  autor gravado. Restrito a `client_admin` e `c4hub_admin`, validado na função —
  não só na tela.

Na listagem, cada registro mostra se foi automático ou manual, e a justificativa
quando houver. A origem entra no cálculo do hash, então uma marcação manual não
pode ser reapresentada como automática sem quebrar a cadeia.

## Quem não bate ponto

Sócios, diretoria e cargos de gestão são isentos (CLT art. 62, II). Na ficha do
colaborador, **Marcação de ponto → Registra ponto? Não**, com o motivo.

Quem é isento não vê o painel de bater ponto, não aparece nas listas de seleção
e não conta como faltante. Se for administrador, continua podendo lançar e
conferir o ponto da equipe. A regra também é aplicada na função do banco: tentar
registrar ponto de alguém isento é recusado no servidor, não apenas escondido na
tela.
