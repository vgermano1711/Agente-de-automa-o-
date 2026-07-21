-- =============================================================================
-- Braseiro Pizzaria — consultas de prática
-- Rode o schema.sql e o seed.sql antes. Cada bloco abaixo é independente:
-- selecione um de cada vez e rode (Ctrl+Enter no Workbench) pra ver o
-- resultado e entender o que ele faz.
-- =============================================================================

USE braseiro_pizzaria;

-- 1) Todos os clientes e seus telefones
SELECT nome, cpf, telefone
FROM pessoa;

-- 2) Todos os endereços de UMA pessoa específica (troque o id_pessoa)
SELECT p.nome, e.apelido, e.logradouro, e.numero, e.bairro, e.cidade
FROM endereco e
JOIN pessoa p ON p.id_pessoa = e.id_pessoa
WHERE p.id_pessoa = 1;

-- 3) Cardápio ordenado por categoria e preço
SELECT nome, categoria, tamanho, preco
FROM produto
ORDER BY categoria, preco;

-- 4) Pedidos com nome do cliente e endereço de entrega (JOIN de 3 tabelas)
SELECT
  pe.id_pedido,
  pes.nome            AS cliente,
  pe.status,
  pe.forma_pagamento,
  CONCAT(en.logradouro, ', ', en.numero, ' — ', en.bairro) AS endereco_entrega
FROM pedido pe
JOIN pessoa  pes ON pes.id_pessoa  = pe.id_pessoa
JOIN endereco en ON en.id_endereco = pe.id_endereco;

-- 5) Valor total de cada pedido (quantidade × preço, somado por pedido)
SELECT
  ip.id_pedido,
  SUM(ip.quantidade * ip.preco_unitario) AS valor_total
FROM item_pedido ip
GROUP BY ip.id_pedido;

-- 6) O mesmo, mas já mostrando o nome do cliente junto (JOIN + GROUP BY)
SELECT
  pe.id_pedido,
  pes.nome AS cliente,
  SUM(ip.quantidade * ip.preco_unitario) AS valor_total
FROM pedido pe
JOIN pessoa pes ON pes.id_pessoa = pe.id_pessoa
JOIN item_pedido ip ON ip.id_pedido = pe.id_pedido
GROUP BY pe.id_pedido, pes.nome
ORDER BY valor_total DESC;

-- 7) Detalhe completo de um pedido: quais produtos, quantidade e subtotal
SELECT
  ip.id_pedido,
  prod.nome AS produto,
  ip.quantidade,
  ip.preco_unitario,
  (ip.quantidade * ip.preco_unitario) AS subtotal
FROM item_pedido ip
JOIN produto prod ON prod.id_produto = ip.id_produto
WHERE ip.id_pedido = 1;

-- 8) Pizza mais pedida (agrupando por produto e somando quantidade)
SELECT
  prod.nome,
  SUM(ip.quantidade) AS total_vendido
FROM item_pedido ip
JOIN produto prod ON prod.id_produto = ip.id_produto
GROUP BY prod.nome
ORDER BY total_vendido DESC;

-- 9) Clientes que ainda não têm nenhum pedido (LEFT JOIN + IS NULL)
SELECT pes.nome
FROM pessoa pes
LEFT JOIN pedido pe ON pe.id_pessoa = pes.id_pessoa
WHERE pe.id_pedido IS NULL;

-- 10) Pedidos que ainda não foram entregues
SELECT id_pedido, status
FROM pedido
WHERE status <> 'entregue' AND status <> 'cancelado';
