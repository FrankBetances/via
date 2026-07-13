//
//  VIAColors.swift
//  VIA+ — Sistema de color nativo.
//
//  Paleta portada 1:1 desde el tema de la app React Native (gluestack + ViaIcon):
//  crema de fondo, tinta cálida para texto y el gradiente naranja del isotipo.
//

import SwiftUI

extension Color {
    /// Inicializador desde hex "#RRGGBB" (o "RRGGBB"). Cae a negro si es inválido.
    init(hex: String) {
        let cleaned = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        let r, g, b, a: Double
        switch cleaned.count {
        case 8: // AARRGGBB
            a = Double((value & 0xFF00_0000) >> 24) / 255
            r = Double((value & 0x00FF_0000) >> 16) / 255
            g = Double((value & 0x0000_FF00) >> 8) / 255
            b = Double(value & 0x0000_00FF) / 255
        default: // RRGGBB
            a = 1
            r = Double((value & 0xFF0000) >> 16) / 255
            g = Double((value & 0x00FF00) >> 8) / 255
            b = Double(value & 0x0000FF) / 255
        }
        self.init(.sRGB, red: r, green: g, blue: b, opacity: a)
    }
}

/// Tokens de color de VIA+. Un único punto de verdad para toda la UI nativa.
enum VIA {
    // Fondos
    static let cream = Color(hex: "#F5F2EC")
    static let creamDeep = Color(hex: "#F1ECE2")
    static let surface = Color(hex: "#FFFFFF")

    // Tinta / texto
    static let ink = Color(hex: "#2B2620")
    static let inkSoft = Color(hex: "#3A352F")
    static let muted = Color(hex: "#8A8375")
    static let placeholder = Color(hex: "#B8B2A7")

    // Acento (naranja de marca)
    static let accent = Color(hex: "#FF7F00")
    static let accentA = Color(hex: "#FDB35C")
    static let accentB = Color(hex: "#FF8A1E")
    static let accentC = Color(hex: "#E85F12")

    /// Gradiente diagonal del isotipo / CTAs primarios.
    static let brandGradient = LinearGradient(
        colors: [accentA, accentB, accentC],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}
