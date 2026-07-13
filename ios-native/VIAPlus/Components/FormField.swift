//
//  FormField.swift
//  VIA+ — Controles de formulario reutilizables.
//
//  Campo etiquetado con el estilo de los inputs de la app RN (fondo crema
//  claro, borde suave, esquinas redondeadas). Unifica los formularios de
//  alta de profesional y de paciente.
//

import SwiftUI
import UIKit

/// Fondo/borde estándar de un input de VIA+.
struct VIAInputBackground: ViewModifier {
    var errorBorder: Bool = false

    func body(content: Content) -> some View {
        content
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(Color(hex: "#FBF9F4"))
            .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 13, style: .continuous)
                    .stroke(errorBorder ? Color(hex: "#DC2626") : Color(hex: "#E9E2D5"),
                            lineWidth: 1.5)
            )
    }
}

extension View {
    func viaInput(errorBorder: Bool = false) -> some View {
        modifier(VIAInputBackground(errorBorder: errorBorder))
    }
}

/// Etiqueta de campo con asterisco opcional para obligatorios.
struct FieldLabel: View {
    let text: String
    var required: Bool = false

    var body: some View {
        HStack(spacing: 2) {
            Text(text)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(Color(hex: "#6E6759"))
            if required {
                Text("*").font(.system(size: 12, weight: .bold)).foregroundStyle(VIA.accent)
            }
        }
    }
}

/// Campo de texto etiquetado (o seguro). Envuelve label + input con el estilo VIA+.
struct FormField: View {
    let label: String
    var required: Bool = false
    var placeholder: String
    @Binding var text: String
    var secure: Bool = false
    var keyboard: UIKeyboardType = .default
    var autocapitalization: TextInputAutocapitalization = .sentences
    var monospaced: Bool = false
    var errorBorder: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            FieldLabel(text: label, required: required)
            Group {
                if secure {
                    SecureField(placeholder, text: $text)
                } else {
                    TextField(placeholder, text: $text)
                }
            }
            .font(.system(size: 15, design: monospaced ? .monospaced : .default))
            .foregroundStyle(VIA.inkSoft)
            .keyboardType(keyboard)
            .textInputAutocapitalization(autocapitalization)
            .autocorrectionDisabled(secure || keyboard == .emailAddress)
            .viaInput(errorBorder: errorBorder)
        }
    }
}
