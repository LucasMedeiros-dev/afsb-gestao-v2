"""
Carga dos parceiros/benefícios vigentes da AFSB.

O card da landing mostra só as 3 primeiras linhas de `beneficios`, por isso o
texto abre com o benefício para o associado e deixa os detalhes para depois.
Idempotente por nome; o reverso apaga só o que esta migração criou.
"""
from django.db import migrations

JOYCE = '(11) 99341-4925 (Joyce/AFSB)'

PARCEIROS = [
    {
        'nome': 'TaxBlue · Recuperação Tributária',
        'site': 'https://www.taxblue.com.br',
        'contato': '(11) 94055-5510 · contato@taxblue.com.br',
        'beneficios': (
            'Recupere PIS/COFINS pago a mais nos produtos monofásicos, com diagnóstico fiscal '
            'gratuito e honorários só sobre o que for recuperado.\n\n'
            'Condições para associados adimplentes:\n'
            '• Diagnóstico fiscal gratuito\n'
            '• Revisão dos últimos 5 anos, com tecnologia e análise fiscal da classificação dos produtos\n'
            '• Honorários de 20%, cobrados apenas sobre o valor efetivamente recuperado'
        ),
    },
    {
        'nome': 'Contro · Etiquetas de Validade',
        'site': None,
        'contato': '(64) 99247-3054',
        'beneficios': (
            'Etiquetas de validade e produção impressas direto do celular, com alertas de '
            'vencimento. Teste grátis por 30 dias e condição especial para associados.\n\n'
            '• Planos: R$ 59,90/mês na 1ª loja e R$ 49,90/mês por loja adicional\n'
            '• Custo aproximado de R$ 0,04 por etiqueta; impressora Bluetooth recomendada por cerca de R$ 150\n'
            '• Padronização, relatórios e dados na nuvem\n'
            '• Teste de 30 dias sem cartão e sem compromisso\n'
            '• Associado AFSB: solicite seu desconto diretamente com a Contro'
        ),
    },
    {
        'nome': 'F360 · Gestão Financeira',
        'site': None,
        'contato': 'Giovanna Ayda · (11) 99306-4257',
        'beneficios': (
            'Gestão financeira, conciliação de cartões e delivery integradas ao SWFast, com '
            'mensalidade a partir de R$ 245 e setup pela metade do preço.\n\n'
            'Mensalidade para associados (de R$ 379):\n'
            '• R$ 281 de 1 a 4 lojas\n'
            '• R$ 263 de 5 a 10 lojas\n'
            '• R$ 245 acima de 10 lojas\n\n'
            'Setup de R$ 800 por R$ 399. Open Finance opcional: R$ 25,90 por conta.\n'
            'Inclui diagnóstico tributário gratuito com a BWA.'
        ),
    },
    {
        'nome': 'Performance · BPO Financeiro',
        'site': 'https://performancebpo.com.br',
        'contato': 'Mariana Salvador · (43) 99988-2159',
        'beneficios': (
            'Terceirize o financeiro da loja com o sistema F360 incluso, a partir de R$ 900 por '
            'CNPJ e sem fidelidade. Contrato revisado pelo Jurídico da AFSB.\n\n'
            'Planos para associados (por CNPJ/mês):\n'
            '• BPO completo, R$ 1.000: contas a pagar, conciliações, F360, implantação, suporte e acompanhamento gerencial\n'
            '• BPO sem contas a pagar, R$ 900: você faz os pagamentos e a Performance acompanha\n\n'
            'Não associados pagam de R$ 1.000 a R$ 1.500 por CNPJ, conforme o número de lojas.'
        ),
    },
    {
        'nome': 'Stelanto · Ponto Eletrônico Digital',
        'site': 'https://stelanto.com.br',
        'contato': 'Wendell · (37) 99867-8091',
        'beneficios': (
            'Ponto pelo celular com reconhecimento facial e geolocalização por R$ 4,50 por '
            'funcionário/mês — menos da metade do preço de mercado (R$ 9,90).\n\n'
            '• Geofencing, banco de horas, horas extras e escalas\n'
            '• Integração com a folha de pagamento e assinatura digital\n'
            '• Não associados: R$ 7,90 por funcionário/mês'
        ),
    },
    {
        'nome': 'Solução Certificados · Certificado Digital',
        'site': 'https://acsolucao.com.br',
        'contato': JOYCE,
        'beneficios': (
            'Certificado digital PF ou PJ, A1 ou A3, por R$ 50 (de R$ 70) — também para as '
            'outras empresas do seu grupo econômico.\n\n'
            '• Emissão 100% online, sem agendamento\n'
            '• Validação por videoconferência, das 8h às 18h\n'
            '• Pagamento via PIX\n'
            '• Franqueados não associados: R$ 80 (de R$ 110)'
        ),
    },
    {
        'nome': 'APTA · Segurança e Saúde do Trabalho (NR-1)',
        'site': 'https://aptast.com.br',
        'contato': 'Juliana Fernandes · (28) 99907-0083',
        'beneficios': (
            'Regularize a loja na NR-1 com pacote completo de SST a partir de R$ 690, em até 10x '
            'no boleto ou cartão.\n\n'
            '• Pacote completo, R$ 1.037 (de R$ 1.200): PGR, PCMSO, LTCAT, eventos do eSocial, '
            'avaliação e levantamento de riscos psicossociais, plataforma e suporte\n'
            '• Pacote essencial, R$ 690: PGR + avaliação psicossocial\n\n'
            'Valores para até 5 colaboradores (pacote completo com até 2 cargos); variam conforme '
            'colaboradores e cargos. Pode ser contratado mesmo que os demais laudos sejam feitos '
            'por outra empresa.'
        ),
    },
    {
        'nome': 'BMF Advogados · Holding e Planejamento Sucessório',
        'site': None,
        'contato': f'juridico@afsb.com.br · {JOYCE}',
        'beneficios': (
            'Análise patrimonial completa e orientação sobre sucessão gratuitas para associados — '
            'um serviço que custa de R$ 5 mil a R$ 10 mil no mercado.\n\n'
            '• Diagnóstico do cenário patrimonial\n'
            '• Orientação sobre holding e planejamento sucessório\n'
            '• Atendimento com a equipe jurídica da Bernardini Martins Ferraz\n\n'
            'Para solicitar, escreva para juridico@afsb.com.br com o assunto '
            '"Holding Patrimonial & Planejamento Sucessório".'
        ),
    },
    {
        'nome': 'BMF Advogados · Blindagem Jurídica 360° da Locação',
        'site': None,
        'contato': f'juridico@afsb.com.br · {JOYCE}',
        'beneficios': (
            'Revisão gratuita do contrato de locação da sua loja, com relatório de riscos e custos '
            'ocultos. Não associados pagam R$ 799.\n\n'
            '• Relatório de riscos e custos ocultos do contrato\n'
            '• Orientações práticas para negociação\n'
            '• Reunião de até 40 minutos com a equipe jurídica\n\n'
            'Para solicitar, envie o contrato para juridico@afsb.com.br com o assunto '
            '"Blindagem Jurídica 360°".'
        ),
    },
    {
        'nome': 'Visio · IA para Operação Subway',
        'site': 'https://app.visio.ai',
        'contato': 'Joesley Bregantin · (16) 92000-7016',
        'beneficios': (
            'Câmeras com IA que conferem a montagem dos lanches, o excesso de ingredientes e os '
            'eventos de caixa. Associados pagam metade na implantação.\n\n'
            '• Implantação com 50% de desconto: R$ 1.200 por loja (condição por tempo limitado)\n'
            '• Plano Base (obrigatório): R$ 399/mês\n'
            '• IA Pista: de R$ 25,90 (1 dia) a R$ 150 (12 dias)\n'
            '• IA Checkout: de R$ 79,90 (1 dia) a R$ 619,90 (10 dias)\n'
            '• Vendas canceladas com o vídeo do momento'
        ),
    },
    {
        'nome': 'Food Nation Tour · Imersão em Food Service',
        'site': 'https://politi.academy/links_afn',
        'contato': f'Cupom com a {JOYCE}',
        'beneficios': (
            '20% de desconto nos ingressos e convites VIP cortesia para a imersão de empresários '
            'de food service que percorre o Brasil.\n\n'
            '• Conteúdo sobre CMV, vendas, processos e gestão de equipe, além de networking\n'
            '• Mentores: Marcelo Politi, Lucas Profeta e Pedro Leite\n'
            '• Convites VIP conforme disponibilidade; peça o cupom à AFSB'
        ),
    },
    # Sem detalhes por enquanto: entram só com o nome.
    {'nome': 'Humanizar RH', 'site': None, 'contato': None, 'beneficios': None},
    {'nome': 'DRE Control', 'site': None, 'contato': None, 'beneficios': None},
    {'nome': 'Jurídico AFSB', 'site': None, 'contato': f'juridico@afsb.com.br · {JOYCE}', 'beneficios': None},
]


def carregar(apps, schema_editor):
    Parceiro = apps.get_model('parceiro', 'Parceiro')
    for dados in PARCEIROS:
        Parceiro.objects.update_or_create(
            nome=dados['nome'],
            defaults={k: v for k, v in dados.items() if k != 'nome'} | {'tipo': 'beneficio'},
        )


def descarregar(apps, schema_editor):
    apps.get_model('parceiro', 'Parceiro').objects.filter(nome__in=[p['nome'] for p in PARCEIROS]).delete()


class Migration(migrations.Migration):
    dependencies = [('parceiro', '0002_initial')]

    operations = [migrations.RunPython(carregar, descarregar)]
