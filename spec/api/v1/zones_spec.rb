# frozen_string_literal: true

require 'rails_helper'

describe Api::V1::Zones, service: :api do
  let(:path) { '/api/v1/zones' }
  let(:json_result) { JSON.parse(response.body, symbolize_names: true) }

  context 'when error' do
    it 'wrong pixels' do
      post path,
           params: {
             pixels: 'Wrong format of pixels',
             receiver_coef: 4,
             measurements: [],
             routers: [{ x: 82, y: 81, coef: '3', frequency: '5.0' }],
             wall_scale: 3.6231884057971016,
             walls: [{ x: { x: 34, y: 28 }, y: { x: 172, y: 28 }, color: '#999999', thickness: 4, length: 500 }]
           }

      expect(response).not_to be_successful
      expect(response.status).to eq 400
      expect(json_result[:error]).to eq 'Pixels have incorrect format'
    end

    it 'wrong routers' do
      post path,
           params: {
             pixels: ['#f0f0f0', '#f0f0f0', '#f0f0f0', '#f0f0f0', '#f0f0f0', '#f0f0f0', '#f0f0f0', '#f0f0f0',
                      '#f0f0f0'],
             receiver_coef: 4,
             measurements: [],
             routers: 'Wrong format of routers',
             wall_scale: 3.6231884057971016,
             walls: [{ x: { x: 34, y: 28 }, y: { x: 172, y: 28 }, color: '#999999', thickness: 4, length: 500 }]
           }

      expect(response).not_to be_successful
      expect(response.status).to eq 400
      expect(json_result[:error]).to eq 'Routers have incorrect format'
    end

    it 'wrong walls' do
      post path,
           params: {
             pixels: ['#f0f0f0', '#f0f0f0', '#f0f0f0', '#f0f0f0', '#f0f0f0', '#f0f0f0', '#f0f0f0', '#f0f0f0',
                      '#f0f0f0'],
             receiver_coef: 4,
             measurements: [],
             routers: [{ x: 82, y: 81, coef: '3', frequency: '5.0' }],
             wall_scale: 3.6231884057971016,
             walls: 'Walls have incorrect format'
           }

      expect(response).not_to be_successful
      expect(response.status).to eq 400
      expect(json_result[:error]).to eq 'Walls have incorrect format'
    end
  end

  context 'when successful' do
    it 'successfull' do
      pixels = ['#f0f0f0', '#f0f0f0', '#f0f0f0', '#f0f0f0', '#f0f0f0', '#f0f0f0', '#f0f0f0', '#f0f0f0', '#f0f0f0']
      post path,
           params: {
             pixels: pixels,
             receiver_coef: 4,
             measurements: [],
             routers: [{ x: 82, y: 81, coef: '3', frequency: '5.0' }],
             wall_scale: 3.6231884057971016,
             walls: [{ x: { x: 34, y: 28 }, y: { x: 172, y: 28 }, color: '#999999', thickness: 4, length: 500 }]
           }

      expect(response).to be_successful
      expect(response.status).to eq 201
      expect(json_result[:error]).to be_nil
      expect(json_result[:pixels]).to be_an_instance_of(Array)
      expect(json_result[:pixels][0]).to be_an_instance_of(String)
      expect(json_result[:pixels]).not_to eq(pixels)
    end
  end
end
