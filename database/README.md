# Banco de dados — Braseiro Pizzaria (MySQL)

Modelo de banco pra praticar, usando uma pizzaria como cenário. Separado do
site (pasta `/site`) de propósito: o site continua 100% estático, e este
banco é um exercício à parte pra você rodar, mexer e quebrar sem medo.

## Arquivos

1. **`schema.sql`** — cria o banco `braseiro_pizzaria` e as 5 tabelas, com
   comentários explicando por que cada relação foi modelada daquele jeito.
2. **`seed.sql`** — popula as tabelas com dados de exemplo (4 clientes,
   5 endereços, 10 produtos, 4 pedidos) pra você já ter o que consultar.
3. **`consultas-exemplo.sql`** — 10 consultas prontas, da mais simples
   (`SELECT` puro) até `JOIN` de três tabelas e `GROUP BY` com soma. Rode
   um bloco de cada vez pra entender o que cada uma faz.

Testei os três arquivos rodando de ponta a ponta num MySQL/MariaDB antes de
entregar — pode confiar que roda sem erro na ordem certa.

## Como rodar

**Opção A — MySQL Workbench**
1. Abra o Workbench e conecte no seu servidor local.
2. `File > Open SQL Script...` → selecione `schema.sql` → clique no raio ⚡
   (Execute) pra rodar tudo.
3. Repita pro `seed.sql`.
4. Abra o `consultas-exemplo.sql`, selecione um bloco de cada vez e rode.

**Opção B — linha de comando**
```bash
mysql -u root -p < schema.sql
mysql -u root -p < seed.sql
mysql -u root -p braseiro_pizzaria < consultas-exemplo.sql
```

**Opção C — phpMyAdmin / XAMPP**
Aba "Importar" → selecione `schema.sql` → Executar. Repita para `seed.sql`.

## O modelo (por que essas tabelas e não outras)

```
pessoa 1─────N endereco
  │
  │ 1
  │
  N
pedido N─────1 endereco   (pedido é entregue em UM dos endereços da pessoa)
  │
  │ 1
  N
item_pedido N─────1 produto
```

- **`pessoa`** — o cliente. CPF é `UNIQUE` porque ninguém pode se cadastrar
  duas vezes com o mesmo CPF.
- **`endereco`** — separado de `pessoa` porque uma pessoa pode ter mais de
  um endereço (relação 1:N). Ligado por `id_pessoa` (chave estrangeira).
- **`produto`** — o cardápio, independente de pedidos.
- **`pedido`** — liga uma pessoa a um endereço de entrega e guarda o status
  (`recebido` → `em_preparo` → `saiu_para_entrega` → `entregue`).
- **`item_pedido`** — resolve a relação N:N entre pedido e produto (um
  pedido tem vários produtos, um produto aparece em vários pedidos). Guarda
  o preço no momento da compra, pra não mudar retroativamente se o cardápio
  mudar de preço depois.

## Pra praticar mais (não fiz, fica de exercício)

- Adicionar uma tabela `pagamento` separada de `pedido` (relação 1:1) —
  bom exercício pra entender quando vale a pena separar uma tabela.
- Validar o CPF de verdade (dígito verificador) — isso é regra de negócio,
  então normalmente fica na aplicação, não no banco.
- Criar uma `VIEW` que já mostra o valor total de cada pedido, baseada na
  consulta #6 do `consultas-exemplo.sql`.
- Adicionar `funcionario` e `entregador`, e ligar `pedido` a quem entregou.
