/**
 * Simulador de Risco de Necrochorume
 *
 * Baseado em parâmetros do CONAMA 335/2003 e literatura técnica:
 * - Silva, R.W.C. & Malagutti Filho, W. (2008) - Geociências UNESP
 * - Kemerich et al. (2012) - Engenharia Sanitária e Ambiental
 *
 * Fatores de risco:
 * 1. Tipo de solo (permeabilidade)
 * 2. Nível do lençol freático
 * 3. Distância de corpos hídricos
 * 4. Volume de enterros / densidade
 * 5. Presença de drenagem
 * 6. Área total vs ocupação
 */

class RiscoService {
  // Calcular risco de necrochorume (0-100%)
  calcularRiscoNecrochorume({
    tipoSolo,
    nivelLencolFreatico,
    distanciaCorpoHidrico,
    volumeEnterrosAnual,
    possuiDrenagem,
    areaTotal,
    totalSepulturas,
  }) {
    let pontuacao = 0;
    let pesoTotal = 0;

    // 1. Tipo de solo (peso 25) - permeabilidade afeta migração do necrochorume
    if (tipoSolo) {
      pesoTotal += 25;
      const riscoSolo = {
        ARENOSO: 90,      // alta permeabilidade = alto risco
        MISTO: 60,
        SILTOSO: 45,
        ARGILOSO: 20,     // baixa permeabilidade = menor risco
        ROCHOSO: 35,
        NAO_INFORMADO: 50,
      };
      pontuacao += (riscoSolo[tipoSolo] || 50) * 0.25;
    }

    // 2. Nível do lençol freático (peso 30) - fator mais crítico
    if (nivelLencolFreatico) {
      pesoTotal += 30;
      let riscoLencol;
      if (nivelLencolFreatico < 1.0) riscoLencol = 100;      // crítico
      else if (nivelLencolFreatico < 1.5) riscoLencol = 85;   // não conforme CONAMA
      else if (nivelLencolFreatico < 2.0) riscoLencol = 60;   // limite
      else if (nivelLencolFreatico < 3.0) riscoLencol = 35;   // aceitável
      else if (nivelLencolFreatico < 5.0) riscoLencol = 15;   // bom
      else riscoLencol = 5;                                     // excelente

      pontuacao += riscoLencol * 0.30;
    }

    // 3. Distância de corpos hídricos (peso 20)
    if (distanciaCorpoHidrico) {
      pesoTotal += 20;
      let riscoAgua;
      if (distanciaCorpoHidrico < 50) riscoAgua = 100;
      else if (distanciaCorpoHidrico < 100) riscoAgua = 80;
      else if (distanciaCorpoHidrico < 200) riscoAgua = 55;   // não conforme CONAMA
      else if (distanciaCorpoHidrico < 500) riscoAgua = 25;
      else riscoAgua = 5;

      pontuacao += riscoAgua * 0.20;
    }

    // 4. Densidade de enterros (peso 15)
    if (volumeEnterrosAnual && areaTotal) {
      pesoTotal += 15;
      const densidade = volumeEnterrosAnual / areaTotal; // enterros por hectare/ano
      let riscoDensidade;
      if (densidade > 200) riscoDensidade = 95;
      else if (densidade > 100) riscoDensidade = 75;
      else if (densidade > 50) riscoDensidade = 50;
      else if (densidade > 20) riscoDensidade = 25;
      else riscoDensidade = 10;

      pontuacao += riscoDensidade * 0.15;
    }

    // 5. Sistema de drenagem (peso 10)
    if (possuiDrenagem !== undefined && possuiDrenagem !== null) {
      pesoTotal += 10;
      pontuacao += (possuiDrenagem ? 10 : 70) * 0.10;
    }

    // Normalizar se não temos todos os dados
    if (pesoTotal > 0 && pesoTotal < 100) {
      pontuacao = (pontuacao / pesoTotal) * 100;
    }

    return Math.round(Math.min(100, Math.max(0, pontuacao)));
  }

  // Gerar relatório detalhado de risco
  gerarRelatorioRisco(cemiterio) {
    const risco = this.calcularRiscoNecrochorume(cemiterio);
    const nivel = this.classificarNivel(risco);

    const problemas = [];
    const recomendacoes = [];

    // Análise do lençol freático
    if (cemiterio.nivelLencolFreatico) {
      if (cemiterio.nivelLencolFreatico < 1.5) {
        problemas.push({
          gravidade: 'CRITICO',
          descricao: `Nível do lençol freático (${cemiterio.nivelLencolFreatico}m) está abaixo do mínimo de 1,5m exigido pela CONAMA 335/2003`,
        });
        recomendacoes.push('Elevar o nível dos sepultamentos ou implementar sistema de jazigos acima do solo (gavetas)');
        recomendacoes.push('Instalar sistema de impermeabilização e drenagem de fundo');
      }
    }

    // Análise da distância de corpos hídricos
    if (cemiterio.distanciaCorpoHidrico) {
      if (cemiterio.distanciaCorpoHidrico < 200) {
        problemas.push({
          gravidade: 'ALTO',
          descricao: `Distância de corpo hídrico (${cemiterio.distanciaCorpoHidrico}m) está abaixo do mínimo de 200m exigido pela CONAMA 335/2003`,
        });
        recomendacoes.push('Implementar barreiras de contenção e poços de monitoramento na direção do corpo hídrico');
      }
    }

    // Análise do solo
    if (cemiterio.tipoSolo === 'ARENOSO') {
      problemas.push({
        gravidade: 'ALTO',
        descricao: 'Solo arenoso apresenta alta permeabilidade, facilitando migração de necrochorume',
      });
      recomendacoes.push('Considerar impermeabilização do fundo das sepulturas com manta geotêxtil');
    }

    // Sistema de drenagem
    if (!cemiterio.possuiDrenagem) {
      problemas.push({
        gravidade: 'MEDIO',
        descricao: 'Ausência de sistema de drenagem de efluentes',
      });
      recomendacoes.push('Instalar sistema de drenagem pluvial e de efluentes conforme CONAMA 335/2003, Art. 4º, II');
    }

    // Superlotação
    if (cemiterio.percentualOcupacao && cemiterio.percentualOcupacao > 90) {
      problemas.push({
        gravidade: 'ALTO',
        descricao: `Cemitério com ${cemiterio.percentualOcupacao.toFixed(1)}% de ocupação - risco de superlotação`,
      });
      recomendacoes.push('Implementar programa de exumação e ossário para liberar covas');
      recomendacoes.push('Avaliar ampliação da área ou criação de cemitério vertical');
    }

    // Sugestão de ossários
    if (cemiterio.totalSepulturas && !cemiterio.possuiOssario) {
      const ossariosNecessarios = Math.ceil(cemiterio.totalSepulturas * 0.3);
      recomendacoes.push(`Construir ossário com capacidade mínima de ${ossariosNecessarios} nichos para resolver superlotação futura`);
    }

    return {
      riscoGeral: risco,
      nivel,
      problemas,
      recomendacoes,
      conformidadeCONAMA: risco <= 40,
      dataAnalise: new Date().toISOString(),
    };
  }

  classificarNivel(risco) {
    if (risco >= 75) return 'CRITICO';
    if (risco >= 50) return 'ALTO';
    if (risco >= 25) return 'MEDIO';
    return 'BAIXO';
  }
}

module.exports = new RiscoService();
