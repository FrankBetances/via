//
//  ViaIcon.swift
//  VIA+ — Isotipo nativo.
//
//  Recreación en SwiftUI del isotipo de la app RN: tesela redondeada con
//  gradiente naranja, 7 barras de voz simétricas en blanco y el signo "+"
//  en la esquina superior derecha. Proporciones portadas del original
//  (viewBox 150×150, alturas de barra 26/46/74/100/74/46/26).
//

import SwiftUI

struct ViaIcon: View {
    enum Variant { case color, ink, white }

    var size: CGFloat = 150
    var variant: Variant = .color

    // Geometría original (sobre una tesela de 150 pt).
    private let barHeights: [CGFloat] = [26, 46, 74, 100, 74, 46, 26]
    private let barW: CGFloat = 9
    private let gap: CGFloat = 9
    private let tile: CGFloat = 150

    private var scale: CGFloat { size / tile }

    private var barColor: Color { variant == .white ? VIA.inkSoft : .white }
    private var plusColor: Color { variant == .color ? .white : VIA.accent }

    var body: some View {
        ZStack {
            // Fondo de la tesela
            background
                .frame(width: size, height: size)
                .clipShape(RoundedRectangle(cornerRadius: size * 0.28, style: .continuous))

            // Barras de voz
            HStack(alignment: .center, spacing: gap * scale) {
                ForEach(barHeights.indices, id: \.self) { i in
                    Capsule()
                        .fill(barColor)
                        .frame(width: barW * scale, height: barHeights[i] * scale)
                }
            }

            // Signo "+" (esquina superior derecha)
            plus
                .frame(width: size, height: size, alignment: .topTrailing)
        }
        .frame(width: size, height: size)
        .accessibilityLabel("VIA+")
    }

    @ViewBuilder private var background: some View {
        switch variant {
        case .color: VIA.brandGradient
        case .ink: VIA.inkSoft
        case .white: VIA.surface
        }
    }

    private var plus: some View {
        Image(systemName: "plus")
            .font(.system(size: size * 0.16, weight: .heavy))
            .foregroundStyle(plusColor)
            .padding(.top, size * 0.11)
            .padding(.trailing, size * 0.12)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
    }
}

#Preview {
    HStack(spacing: 20) {
        ViaIcon(size: 96, variant: .color)
        ViaIcon(size: 96, variant: .ink)
        ViaIcon(size: 96, variant: .white)
    }
    .padding()
    .background(VIA.cream)
}
